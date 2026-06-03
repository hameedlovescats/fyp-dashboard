import numpy as np


def log1p_clip(x, clip_min: float = 0.0):
        """
        Clip values at clip_min then apply log1p.

        IMPORTANT:
        - This function must live in an importable module (transforms.py),
            not inside a training script (__main__), so that joblib can load
            saved models on any machine.
        """
        arr = np.asarray(x, dtype=float)
        arr = np.clip(arr, clip_min, None)
        return np.log1p(arr)
