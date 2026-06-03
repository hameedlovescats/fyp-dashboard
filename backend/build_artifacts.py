import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

import transforms

from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    precision_recall_fscore_support,
    roc_auc_score,
    brier_score_loss,
    confusion_matrix,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler


DEFAULT_FEATURES: List[str] = [
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_4",
    "lag_5",
    "lag_6",
    "lag_7",
    "lag_8",
    "woy_sin",
    "woy_cos",
]


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, obj: Dict[str, Any]) -> None:
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _as_float_frame(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    out = df[cols].copy()
    for c in cols:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    out = out.replace([np.inf, -np.inf], np.nan)
    if out.isna().any().any():
        bad = [c for c in cols if out[c].isna().any()]
        raise ValueError(f"Non-numeric or missing values in columns: {bad}")
    return out.astype(float)


def train_lr_from_alert_history(
    alert_history_csv: Path,
    lr_metrics_json: Optional[Path] = None,
    results_dir: Optional[Path] = None,
) -> Tuple[Pipeline, Dict[str, Any], Dict[str, Any]]:
    """
    Train a portable Logistic Regression model using the already-engineered features
    in alert_history.csv (lags + woy_sin/woy_cos) and save clean artifacts.

    This avoids the old joblib issue where a function was pickled from __main__.
    """
    if not alert_history_csv.exists():
        raise FileNotFoundError(f"Missing alert history CSV: {alert_history_csv}")

    metrics_seed: Dict[str, Any] = _read_json(lr_metrics_json) if lr_metrics_json else {}

    feature_cols: List[str] = metrics_seed.get("features") or list(DEFAULT_FEATURES)
    threshold: float = float(metrics_seed.get("prob_threshold", 0.5))
    log1p_enabled: bool = bool(metrics_seed.get("log1p", True))

    df = pd.read_csv(alert_history_csv)
    if "y" not in df.columns:
        raise ValueError("alert_history.csv must include a 'y' label column (0/1).")
    if "split" not in df.columns:
        df["split"] = "train"

    required = set(feature_cols + ["y", "split"])
    missing = sorted(list(required - set(df.columns)))
    if missing:
        raise ValueError(f"alert_history.csv missing required columns: {missing}")

    train_df = df[df["split"].astype(str).str.lower() == "train"].copy()
    test_df = df[df["split"].astype(str).str.lower() == "test"].copy()

    if len(train_df) < 50:
        raise ValueError(f"Too few training rows: {len(train_df)}")
    if len(test_df) < 10:
        test_df = df[df["split"].astype(str).str.lower() != "train"].copy()

    X_train = _as_float_frame(train_df, feature_cols)
    y_train = pd.to_numeric(train_df["y"], errors="coerce").astype(int).to_numpy()

    lag_cols = [c for c in feature_cols if c.startswith("lag_")]
    season_cols = [c for c in feature_cols if c in ("woy_sin", "woy_cos")]

    transformers = []

    if log1p_enabled and lag_cols:
        transformers.append(
            (
                "lag_log1p",
                FunctionTransformer(
                    transforms.log1p_clip,
                    kw_args={"clip_min": 0.0},
                    validate=False,
                ),
                lag_cols,
            )
        )
    elif lag_cols:
        transformers.append(("lags", "passthrough", lag_cols))

    if season_cols:
        transformers.append(("season", "passthrough", season_cols))

    preprocess = ColumnTransformer(transformers=transformers, remainder="drop")

    model = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        solver="lbfgs",
    )

    pipe = Pipeline(
        steps=[
            ("preprocess", preprocess),
            ("scale", StandardScaler()),
            ("clf", model),
        ]
    )

    pipe.fit(X_train, y_train)

    eval_metrics: Dict[str, Any] = {
        "model": "Logistic Regression (portable)",
        "log1p": log1p_enabled,
        "prob_threshold": threshold,
        "n_features": len(feature_cols),
        "features": feature_cols,
        "n_train": int(len(train_df)),
        "n_test": int(len(test_df)) if len(test_df) else 0,
    }

    if len(test_df):
        X_test = _as_float_frame(test_df, feature_cols)
        y_test = pd.to_numeric(test_df["y"], errors="coerce").astype(int).to_numpy()
        proba = pipe.predict_proba(X_test)[:, 1]
        y_pred = (proba >= threshold).astype(int)

        prec, rec, f1, _ = precision_recall_fscore_support(
            y_test, y_pred, average="binary", zero_division=0
        )

        if len(np.unique(y_test)) == 2:
            eval_metrics["roc_auc"] = float(roc_auc_score(y_test, proba))
            eval_metrics["pr_auc"] = float(average_precision_score(y_test, proba))
        else:
            eval_metrics["roc_auc"] = None
            eval_metrics["pr_auc"] = None

        eval_metrics["precision"] = float(prec)
        eval_metrics["recall"] = float(rec)
        eval_metrics["f1"] = float(f1)

    meta: Dict[str, Any] = {
        "model_name": "Logistic Regression",
        "feature_columns": feature_cols,
        "decision_threshold": threshold,
        "prob_threshold": threshold,
        "log1p": log1p_enabled,
    }

    if results_dir:
        _ensure_dir(results_dir)
        joblib.dump(pipe, results_dir / "lr_model.joblib")
        _write_json(results_dir / "lr_meta.json", meta)
        _write_json(results_dir / "lr_metrics.json", eval_metrics)

    return pipe, meta, eval_metrics


def ensure_backend_results(backend_dir: Path, prefer_public: bool = True) -> Path:
    """
    Ensure backend/results contains everything needed for the API to run.

    It will:
    1) Copy existing public exports into backend/results (if present)
    2) Train and save lr_model.joblib + lr_meta.json if missing
    """
    backend_dir = backend_dir.resolve()
    results_dir = backend_dir / "results"
    public_dir = backend_dir.parent / "public"

    _ensure_dir(results_dir)

    def copy_if_exists(src: Path, dst: Path) -> None:
        if src.exists() and not dst.exists():
            dst.write_bytes(src.read_bytes())

    if prefer_public and public_dir.exists():
        copy_if_exists(public_dir / "alert_history.csv", results_dir / "alert_history.csv")
        copy_if_exists(public_dir / "latest_alerts.json", results_dir / "latest_alerts.json")
        copy_if_exists(public_dir / "model_comparison.csv", results_dir / "model_comparison.csv")
        copy_if_exists(public_dir / "lr_metrics.json", results_dir / "lr_metrics.json")

    model_path = results_dir / "lr_model.joblib"
    meta_path = results_dir / "lr_meta.json"

    if not model_path.exists() or not meta_path.exists():
        hist = results_dir / "alert_history.csv"
        metrics_seed = results_dir / "lr_metrics.json"
        if not hist.exists():
            raise FileNotFoundError(
                f"Cannot train model because alert_history.csv is missing in {results_dir} and {public_dir}."
            )

        train_lr_from_alert_history(
            alert_history_csv=hist,
            lr_metrics_json=metrics_seed if metrics_seed.exists() else None,
            results_dir=results_dir,
        )

    return results_dir


if __name__ == "__main__":
    bdir = Path(__file__).resolve().parent
    out = ensure_backend_results(bdir, prefer_public=True)
    print(f"OK: ensured artifacts in {out}")


def compute_calibration_curve(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    n_bins: int = 10,
) -> Dict[str, Any]:
    """
    Compute calibration curve data and Brier score.
    Returns points for reliability diagram: [(prob_mean, fraction_positives), ...]
    """
    if len(y_true) < 2:
        return {"brier_score": None, "curve": [], "n_samples": len(y_true)}

    brier = float(brier_score_loss(y_true, y_proba))

    # Bin predictions
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    bin_centers = (bins[:-1] + bins[1:]) / 2.0
    bin_sums = np.zeros(n_bins)
    bin_true = np.zeros(n_bins)
    bin_total = np.zeros(n_bins)

    for i in range(n_bins):
        mask = (y_proba >= bins[i]) & (y_proba < bins[i + 1])
        if i == n_bins - 1:
            mask = (y_proba >= bins[i]) & (y_proba <= bins[i + 1])
        if mask.sum() > 0:
            bin_total[i] = float(mask.sum())
            bin_true[i] = float(y_true[mask].sum())
            bin_sums[i] = bin_true[i] / bin_total[i] if bin_total[i] > 0 else 0.0

    curve = [
        {"prob_pred": float(bin_centers[i]), "prob_true": float(bin_sums[i]), "count": int(bin_total[i])}
        for i in range(n_bins)
        if bin_total[i] > 0
    ]

    return {"brier_score": brier, "curve": curve, "n_samples": int(len(y_true))}


def compute_threshold_sweep(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    thresholds: Optional[List[float]] = None,
) -> List[Dict[str, Any]]:
    """
    Compute metrics (precision, recall, f1, specificity) across different thresholds.
    """
    if thresholds is None:
        thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.67, 0.7, 0.8, 0.9]

    results = []
    for threshold in sorted(set(thresholds)):
        threshold = float(threshold)
        y_pred = (y_proba >= threshold).astype(int)

        # Handle edge cases
        if len(np.unique(y_pred)) == 1 or len(np.unique(y_true)) == 1:
            prec, rec, f1 = 0.0, 0.0, 0.0
        else:
            prec, rec, f1, _ = precision_recall_fscore_support(
                y_true, y_pred, average="binary", zero_division=0
            )
            prec, rec, f1 = float(prec), float(rec), float(f1)

        # Specificity (True Negative Rate)
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

        # Sensitivity = Recall
        sensitivity = rec

        results.append(
            {
                "threshold": threshold,
                "precision": prec,
                "recall": rec,
                "sensitivity": sensitivity,
                "specificity": specificity,
                "f1": f1,
                "n_predicted_positive": int((y_pred == 1).sum()),
                "n_predicted_negative": int((y_pred == 0).sum()),
            }
        )

    return results


def compute_interpretability(
    model: Pipeline,
    feature_cols: List[str],
) -> Dict[str, Any]:
    """
    Extract logistic regression coefficients and convert to odds ratios.
    Returns feature importance ranked by absolute log-odds.
    """
    try:
        # Get the LR model from the pipeline
        clf = model.named_steps.get("clf")
        if clf is None or not isinstance(clf, LogisticRegression):
            return {"error": "Model is not LogisticRegression", "features": []}

        coef = clf.coef_[0]
        intercept = float(clf.intercept_[0])

        if len(coef) != len(feature_cols):
            return {"error": f"Coefficient mismatch: {len(coef)} coefs vs {len(feature_cols)} features"}

        # Compute odds ratios
        odds_ratios = np.exp(coef)

        # Bundle results
        features_detail = []
        for i, fname in enumerate(feature_cols):
            log_odds = float(coef[i])
            odds_ratio = float(odds_ratios[i])
            features_detail.append(
                {
                    "feature": fname,
                    "log_odds": log_odds,
                    "odds_ratio": odds_ratio,
                    "interpretation": (
                        f"Each unit increase in {fname} multiplies odds of high-risk by {odds_ratio:.3f}"
                    ),
                }
            )

        # Sort by absolute log-odds (most impactful first)
        features_detail.sort(key=lambda x: abs(x["log_odds"]), reverse=True)

        return {
            "intercept": intercept,
            "log_odds_intercept": f"exp({intercept:.4f}) = {np.exp(intercept):.4f}",
            "features": features_detail,
        }
    except Exception as e:
        return {"error": str(e), "features": []}
