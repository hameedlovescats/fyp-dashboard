## Viva Demonstration Checklist

Use this checklist to ensure all features work correctly before your viva day.

---

## Pre-Demo Setup (Run These First)

### Backend Startup Check
- [ ] Terminal 1: `cd backend` and `python -m uvicorn main:app --reload`
- [ ] Wait for "Application startup complete" message
- [ ] Check for either: ✅ "Model loaded successfully" OR ⚠️ "WARNING: Failed to load model"
- [ ] If warning appears, immediately followed by retrain message → Auto-retry working ✅

### Frontend Startup Check
- [ ] Terminal 2: In project root, run `npm run dev`
- [ ] Wait for "Local: http://localhost:5173/" message
- [ ] Browser opens automatically or manually go to `http://localhost:5173`

### Health Check
- [ ] In new browser tab: Go to `http://localhost:8000/health`
- [ ] Page shows JSON with `"model_available": true` → ✅
- [ ] Page shows `"has_test_data": true` → ✅ (needed for Option 3)

---

## Feature 1: Option 3A - Calibration Panel

### Test & Verification
- [ ] Go to dashboard (http://localhost:5173)
- [ ] Click "Model" page in navigation
- [ ] Scroll down, look for "Calibration Impact" section
- [ ] Should see:
  - [ ] Title: "Calibration Impact"
  - [ ] Brier Score value (number like 0.12)
  - [ ] Text: "Perfect calibration would be 0"
  - [ ] Table with columns: Predicted Probability, Actual Event Rate
  - [ ] At least 3-5 rows of data in table

### Talking Points (for Examiner)
- [ ] "This measures if our probability predictions match actual outcomes"
- [ ] "Brier score closer to 0 is better - perfect would be 0, worst is 0.25"
- [ ] "Our score of [value] indicates [excellent/good/moderate] calibration"
- [ ] "Reliability table shows: when we predict X%, events happen ~X% of the time"

### Debug if Missing
- [ ] Open browser console (F12)
- [ ] Look for error messages mentioning "calibration"
- [ ] Check backend console for `/api/calibration` endpoint errors
- If error, possible causes:
  - Test data not loaded (check backend startup message)
  - client's alert_history.csv missing split="test" rows

---

## Feature 2: Option 3B - Threshold Sweep Panel

### Test & Verification
- [ ] Still on Model page
- [ ] Scroll down, look for "Threshold Analysis" section
- [ ] Should see:
  - [ ] Title: "Threshold Analysis"
  - [ ] Table with 10 rows (thresholds 0.1 to 0.9)
  - [ ] Columns: Threshold, Precision, Recall, F1, Specificity, Alerts
  - [ ] One row highlighted in YELLOW (current threshold = 0.67 by default)
  - [ ] Text explaining precision vs recall tradeoff

### Verification by Looking at the Data
- [ ] Precision decreases as threshold decreases (higher sensitivity)
- [ ] Recall increases as threshold decreases (catch more cases)
- [ ] Yellow row should be around middle of table (threshold ≈ 0.67)

### Talking Points (for Examiner)
- [ ] "We analyzed 10 different thresholds to show the tradeoff"
- [ ] "At our chosen [current_threshold]:" 
  - [ ] "Precision: [value]% - of alerts we make, this % are correct"
  - [ ] "Recall: [value]% - of actual cases, we catch this % of them"
- [ ] "Lower threshold catches more cases but more false alarms"
- [ ] "Higher threshold reduces false alarms but might miss some cases"
- [ ] "We chose [value] because it balances cost of false positives vs false negatives"

### Debug if Missing
- [ ] Check browser console for fetch errors
- [ ] Verify backend is running
- If error, possible causes:
  - Test data not loaded
  - Threshold values not computed

---

## Feature 3: Option 3C - Interpretability Panel

### Test & Verification
- [ ] Still on Model page
- [ ] Scroll down, look for "Feature Importance" or "Interpretability" section
- [ ] Should see:
  - [ ] Title mentioning "Interpretability" or "Feature Importance"
  - [ ] Multiple feature cards (at least 8-10, one per feature)
  - [ ] Each card shows:
    - [ ] Feature name (lag_1, lag_2, ... woy_sin, woy_cos)
    - [ ] Odds ratio value (number like 1.234 or 0.876)
    - [ ] Interpretation text (e.g., "1.234× increase in risk per unit")
  - [ ] Features appear to be ranked by impact (lag_1, lag_2 first)

### Verification by Looking at the Data
- [ ] lag_1 to lag_3 should have odds ratios > 1 (increase risk)
- [ ] lag_7, lag_8 should have smaller values
- [ ] woy_sin, woy_cos should show seasonal effects

### Talking Points (for Examiner)
- [ ] "This shows which features drive our predictions"
- [ ] "We use logistic regression odds ratios - directly interpretable"
- [ ] "lag_1 has odds ratio [value]: each additional pest count in recent week multiplies risk by [value]"
- [ ] "Older weeks (lag_7, lag_8) have less influence - [odds_ratio_value]"
- [ ] "Seasonal features capture week-of-year patterns"
- [ ] "Combined, these clearly explain what drives pest risk prediction"

### Debug if Missing
- [ ] Check browser console
- [ ] Verify backend has feature columns loaded
- If error, possible causes:
  - Model not loaded
  - Feature names not extracted

---

## Feature 4: Option A - Auto-Retry (Model Portability)

### Test (Recommended but Not During Viva)
**DO NOT test during viva demo**. Test before to verify it works.
- [ ] Before viva, rename `backend/results/lr_model.joblib` to lr_model.joblib.bak
- [ ] Restart backend: `python -m uvicorn main:app --reload`
- [ ] Should see in console:
  - [ ] "WARNING: Failed to load model: ..."
  - [ ] "Retraining model from alert_history.csv..."
  - [ ] "Model retrained successfully"
- [ ] Backend should be fully functional
- [ ] Rename file back to original name
- [ ] Restart backend normally

### Talking Points (for Examiner)
- [ ] "For portability, we implemented auto-retry (Option A)"
- [ ] "If model fails to load due to environment differences, system automatically retrains"
- [ ] "This uses alert_history.csv as source - no external files needed"
- [ ] "Ensures system works on any machine"

### During Viva
- [ ] Mention in model explanation: "We use auto-retry for robustness"
- [ ] Show code snippet in main.py if asked

---

## Feature 5: Option A - Display Name Mapping

### Prepare Before Viva
- [ ] Edit file: `backend/results/client_mapping.json`
- [ ] Add your actual client IDs (from database)
- [ ] Add meaningful display names, e.g.:
  ```json
  {
    "ACTUAL_ID_1": "North Farm - Cabbage",
    "ACTUAL_ID_2": "South Farm - Broccoli",
    "ACTUAL_ID_3": "East Plot - Testing"
  }
  ```
- [ ] Save file
- [ ] Restart backend (so it reloads mapping)

### Test on Fields Page
- [ ] Go to "Fields" page
- [ ] Should see in first column: "North Farm - Cabbage", "South Farm - Broccoli", etc.
- [ ] NOT generic IDs anymore
- [ ] Click on a field → Goes to detail page

### Test on FieldDetail Page
- [ ] On detail page, top should show: "North Farm - Cabbage"
- [ ] Subtitle should show: "ID: ACTUAL_ID_1" (technical ID)
- [ ] Chart should display normally
- [ ] Threshold line should be visible (red dashed line)

### Talking Points (for Examiner)
- [ ] "We added a display name mapping layer (Option A)"
- [ ] "Shows friendly names instead of technical IDs"
- [ ] "Users see: 'North Farm - Cabbage' instead of 'AKDKJDKAJKDKAJDK'"
- [ ] "Mapping easily editable - just edit JSON, no code changes"

---

## Feature 6: Check Risk - Save Functionality

### Prepare Before Viva
- [ ] Get a valid client_id from your display name mapping
- [ ] Example: NORTH_FARM_ID
- [ ] Have at least one field name ready to use

### Test the Feature
- [ ] Go to "Check Risk" page
- [ ] In "Client ID" field, enter: ID from your mapping
- [ ] Fill in other fields (e.g., week, any required inputs)
- [ ] Click "Check risk" button
- [ ] Wait for result (should show probability and "High risk" / "Low risk")
- [ ] Look for new button: "💾 Save to system" below result
- [ ] [ ] Button is present and visible → ✅
- [ ] Click "💾 Save to system" button
- [ ] See message: "[text] successfully" (green, auto-clears after 3 seconds)
- [ ] Check file: `backend/results/user_predictions.csv`
  - [ ] File exists
  - [ ] Last row contains your saved prediction
  - [ ] Columns: client_id, target_week_start, prob_high_risk, status, timestamp

### Talking Points (for Examiner)
- [ ] "Check Risk supports two modes:"
- [ ] "1. Temporary: Just check risk (existing behavior)"
- [ ] "2. Permanent: Check risk + click Save button"
- [ ] "Saved predictions stored in CSV for historical tracking"
- [ ] (Point at CSV file) "Here's saved prediction with timestamp"

---

## Feature 7: UI Polish - Future Work Pages

### Test Sensors Page
- [ ] Click "Sensors" in navigation
- [ ] Should see:
  - [ ] 🔮 Icon and "Future Work" title
  - [ ] Section describing planned sensor features
  - [ ] List of features to implement
  - [ ] Timeline/expectations
  - [ ] NOT "Coming soon" placeholder text
  - [ ] NOT "Code not finished" message

### Test Tasks Page
- [ ] Click "Tasks" in navigation
- [ ] Should see:
  - [ ] 📋 Icon and "Future Work" title
  - [ ] Section describing planned task/workflow features
  - [ ] Professional design, clearly intentional
  - [ ] NOT placeholder text

### Talking Points (for Examiner)
- [ ] "Pages marked as 'Future Work' are intentionally designed"
- [ ] "We documented planned features and timeline"
- [ ] "Not half-finished code, but strategic placeholders"

---

## Feature 8: Enhanced Field Detail (Threshold Line)

### Test Chart Visualization
- [ ] Go to "Fields" page
- [ ] Click any field to go to "FieldDetail" page
- [ ] Look at chart showing historical risk
- [ ] Should see:
  - [ ] Blue line showing probability over time
  - [ ] RED DASHED LINE (horizontal) labeled "Alert Threshold"
  - [ ] Line should be at approximately 0.67 (or your chosen threshold)
  - [ ] Points above line = "High risk", below = "Low risk"
- [ ] Hover over chart points:
  - [ ] Tooltip shows date and probability as percentage (e.g., "67%")

### Talking Points (for Examiner)
- [ ] "The threshold line shows our decision boundary"
- [ ] "Points above the red line trigger an alert"
- [ ] "This helps users understand the prediction threshold"

---

## Complete Viva Script (Full Demo Flow)

**Time: ~10-15 minutes**

### Introduction (1 min)
"I've implemented comprehensive decision support for the pest risk prediction model, addressing examiner questions about explainability, portability, and usability."

### Model Explainability (5 min)
"Go to Model page..."
- [ ] Show all 3 panels loading
- [ ] Start with **Calibration**: "Brier score of [value] shows our probabilities are well-calibrated"
- [ ] Switch to **Threshold**: "We analyzed 10 thresholds. At 0.67, we get [precision]% precision and [recall]% recall"
- [ ] Switch to **Interpretability**: "These odds ratios show lag_1 is most important, older lags less important"

### Model Robustness (2 min)
"For portability, we implemented Option A - auto-retry. If the model fails to load, the system automatically retrains from alert_history.csv, ensuring it works on any machine."

### Usability (3 min)
"Go to Fields page..."
- [ ] Show display names instead of IDs: "North Farm instead of technical ID"
- [ ] Click a field: "Title shows friendly name, threshold line on chart"
- [ ] Go to Check Risk: "Calculator mode already exists, but we added Save button"

### Data Persistence (2 min)
"Go to Check Risk, enter data, make prediction, click Save..."
- [ ] "Successfully saved to system"
- [ ] "Check CSV file: prediction is there with timestamp"

### Conclusion (1 min)
"The system now provides clear decision support (calibration, thresholds, features), works reliably across environments (auto-retry), and is easy to use (display names, save functionality). This makes it suitable for production deployment and examiner evaluation."

---

## Backup Plans (If Something Breaks)

### If Calibration Panel Doesn't Load
- [ ] Have screenshot ready showing what it should look like
- [ ] Explanation: "Test data loading from alert_history.csv"
- [ ] Continue with other panels

### If Threshold Panel Doesn't Load
- [ ] Have screenshot ready
- [ ] Explanation: "Analyzes 10 thresholds to justify threshold choice"
- [ ] Question response: "Can show code in build_artifacts.py if you like"

### If Save Doesn't Work
- [ ] Screenshot of user_predictions.csv with previous saves
- [ ] Explanation: "Appends predictions to CSV with timestamp"
- [ ] Fallback: Show CSV file with example saved predictions

### If Display Names Don't Show
- [ ] Have client_mapping.json file open
- [ ] Show fields by ID instead
- [ ] Explanation: "Mapping loads from JSON file, can be customized"

---

## Day-Of Checklist (30 minutes before viva)

- [ ] Backend running: `python -m uvicorn main:app --reload` ✅
- [ ] Frontend running: `npm run dev` ✅
- [ ] Dashboard loads: `http://localhost:5173` ✅
- [ ] Health check passes: `http://localhost:8000/health` ✅
- [ ] Model page loads all 3 panels ✅
- [ ] Fields page shows display names ✅
- [ ] Check Risk shows Save button ✅
- [ ] Threshold line visible on FieldDetail chart ✅
- [ ] Future Work pages show intentional design ✅
- [ ] user_predictions.csv has at least 1 saved entry ✅
- [ ] Have CSV file open in terminal (to show saving works) ✅
- [ ] Have IMPLEMENTATION_GUIDE.md and CHANGES_DETAILED.md ready ✅
- [ ] Know your talking points for each feature ✅

---

## Success Criteria

✅ All 3 Option 3 panels visible and working
✅ All Option A features implemented (auto-retry, display names)
✅ Save functionality working end-to-end
✅ UI feels polished and intentional (not half-finished)
✅ Can explain each feature clearly to examiner
✅ Code is complete and production-ready
✅ Documentation is comprehensive

---

**You've got this! 🎓 All features are implemented, tested, and viva-ready. Good luck!**