## Quick Start: Running the Enhanced Dashboard

This guide gets you running and testing the new features in 5 minutes.

### Step 1: Start the Backend (Python)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

**Check startup logs for these messages**:
- ✅ "Model loaded successfully" → Model is working
- ⚠️ "WARNING: Failed to load model" + "Model retrained from alert_history.csv" → Auto-retry worked (Option A)
- ℹ️ "Loaded test data for calibration" → Option 3 panels will work

### Step 2: Start the Frontend (JavaScript)

In a **new terminal**:
```bash
npm install  # if needed
npm run dev
```

Expected output:
```
Local:   http://localhost:5173/
```

### Step 3: Quick Test Checklist (2 minutes)

1. **Health Check**
   - In browser, visit: `http://localhost:8000/health`
   - Should show: `"model_available": true, "has_test_data": true`

2. **Test Option 3 Panels**
   - Go to dashboard: `http://localhost:5173`
   - Click "Model" page
   - Wait 2-3 seconds, should see 3 new sections:
     - Calibration (shows Brier score)
     - Threshold Sweep (shows table with thresholds)
     - Interpretability (shows feature odds ratios)
   - If these don't appear, check browser console for errors

3. **Test Display Names**
   - Click "Fields" page
   - Should see field names like "Field A (Primary)" in first column
   - Not generic IDs

4. **Test Save Functionality**
   - Click "Check Risk" page
   - Enter a client ID from the Fields page
   - Click "Check risk" button
   - Prediction appears
   - New "💾 Save to system" button appears below result
   - Click it → Success message shows
   - Check file: `backend/results/user_predictions.csv` → New row added

### Step 4: Customize (Optional)

**Add your own field names**:
```bash
# Edit this file
backend/results/client_mapping.json
```

Example:
```json
{
  "BBHYPSPSNSSX": "North Farm - Cabbage",
  "XXYYZZAABBCC": "South Farm - Broccoli"
}
```

Reload dashboard → Field page shows your names

**Change alert threshold**:
```bash
# Edit this file
backend/results/lr_metrics.json
# Change "prob_threshold" value from 0.67 to your value
```

Reload dashboard → Threshold Sweep panel updates

### Step 5: For Viva Demo

**Talking points for each panel**:

**Calibration Panel**:
- "Brier score measures probability calibration"
- "Shows if our probabilities match actual outcomes"
- Lower is better (0 = perfect)

**Threshold Sweep Panel**:
- "We tested 10 different thresholds"
- "Higher threshold = fewer false alarms, more missed cases"
- "0.67 balances precision vs recall"
- (Point at yellow highlighted row)

**Interpretability Panel**:
- "Shows which features drive predictions"
- "Odds ratios > 1 increase risk, < 1 decrease risk"
- "lag_1 most influential (recent counts matter most)"

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend crashes on startup | Check `alert_history.csv` exists in backend folder |
| Model shows warning message | Normal! Auto-retrain (Option A) is working |
| Option 3 panels don't load | Check browser console (F12) for errors. Verify test data exists |
| Display names show as IDs | Reload page. Check client_mapping.json syntax |
| Save button fails | Check browser console. Verify backend has write access |
| 404 errors on API calls | Backend not running or port 8000 blocked |

### Files to Show Examiner

1. `IMPLEMENTATION_GUIDE.md` ← Comprehensive documentation (this repo)
2. `backend/main.py` ← Auto-retry logic + new endpoints
3. `src/pages/Model.jsx` ← Option 3 panels
4. `backend/results/user_predictions.csv` ← Saved predictions (demo saving)
5. `backend/results/client_mapping.json` ← Display name mapping

---

**Ready? Start backend, then frontend, then go to http://localhost:5173 and explore! 🚀**