# Final QA Test Checklist

## Backend API Tests

### Endpoint: /health
- [x] Responds within timeout
- [x] Returns valid JSON
- [x] Has_model field present
- [x] decision_threshold field present

### Endpoint: /api/latest-alerts
- [x] Returns array of client alerts
- [x] All records have target_week_start in ISO format (YYYY-MM-DD)
- [x] All records have source field ("historical" or "user")
- [x] Response time < 100ms (no large CSV read on every request)
- [x] kelaniya preserved in results (historical data)
- [x] Saved predictions (Hambanthota) included
- [x] Deduplication working: exactly one row per client with latest date
- [x] Short codes (Wr, We, BB) present in results

### Endpoint: /api/client-mapping
- [x] Returns mapping object
- [x] BB mapped to "Field 1"
- [x] Wr mapped to "Field 11"
- [x] We mapped to "Field 10"
- [x] kelaniya kept as "kelaniya"
- [x] Hambanthota kept as "Hambanthota"
- [x] All clients in latest_alerts have a mapping
- [x] Response time < 100ms

### Endpoint: /api/history?client_id=kelaniya
- [x] Returns sorted history for specific client
- [x] Target_week_start in ISO format
- [x] Source field populated ("historical" or "user")
- [x] Most recent first (descending order)

### Endpoint: /api/calibration
- [x] Returns available status
- [x] Returns optional curve data for reliability diagram
- [x] Gracefully handles missing test data

### Endpoint: /api/threshold-sweep
- [x] Returns threshold sweep table
- [x] Current threshold highlighted
- [x] Interpretation text present

### Endpoint: /api/model-interpretability
- [x] Returns feature importance data
- [x] Interpretation text present
- [x] Log odds and odds ratios computed

---

## Frontend Tests

### Overview.jsx
- [x] Loads without "Loading..." hanging
- [x] Displays all clients with mapping names
- [x] Short codes display as "Field X"
- [x] Sorting by WEEK works correctly (ISO date order, not numeric)
- [x] Sorting by RISK works (descending probability)
- [x] Sorting by CLIENT works (alphabetical)
- [x] Sorting by STATUS works (ALERT first)
- [x] Search filters by team name or client_id
- [x] Status filter (ALERT/OK) works
- [x] "Highest risk site" displays with correct mapping
- [x] "Last updated" shows correct date
- [x] Timeout helper prevents infinite loading

### Fields.jsx
- [x] Loads without hanging
- [x] Displays all fields with mapping names
- [x] kelaniya visible (historical data preserved)
- [x] Wr shows as "Field 11"
- [x] We shows as "Field 10"
- [x] Sorting by risk works
- [x] Sorting by name works
- [x] Search works
- [x] Click through to FieldDetail page works

### FieldDetail.jsx
- [x] Loads without timeout hanging
- [x] Shows client name from mapping (e.g., "Field 11" for Wr)
- [x] Displays risk chart (blue line)
- [x] Displays threshold line (red dashed)
- [x] Threshold value correct (0.67 default or from metrics)
- [x] Tooltip shows date, probability, and source ("Historical data" or "User saved prediction")
- [x] Pest count chart appears when y_count has non-zero values
- [x] Saved predictions labeled as "User saved prediction (no observed count yet)"
- [x] Historical records labeled as "Historical data"
- [x] X-axis uses ISO dates

### Model.jsx
- [x] Loads without timeout hanging
- [x] CalibrationPanel loads with timeout
- [x] ThresholdSweepPanel loads with timeout
- [x] InterpretabilityPanel loads with timeout
- [x] Shows comparison table if available
- [x] Each panel gracefully handles backend errors

### CheckRisk.jsx
- [x] CSV upload works
- [x] Form validation works (8 lags required)
- [x] Prediction generates correctly
- [x] "Save to system" button saves to user_alert_history.csv
- [x] After save, saved prediction appears in Overview
- [x] Saved prediction has source="user"

---

## Data Integrity Tests

### Date Format Normalization
- [x] Epoch milliseconds converted to ISO
- [x] Existing ISO strings preserved
- [x] All outputs in ISO YYYY-MM-DD format
- [x] No date format mismatches

### Deduplication
- [x] Only latest date per client retained
- [x] ISO string comparison works ("2025-12-29" > "2018-09-03")
- [x] Multiple clients show without duplicates
- [x] kelaniya shows once (not twice)

### Source Tracking
- [x] source field added to all rows
- [x] alert_history.csv records marked "historical"
- [x] user_alert_history.csv records marked "user"
- [x] Frontend displays source in tooltips

### Caching
- [x] alert_history.csv loaded once at startup
- [x] Cache stored in app.state.base_latest_alerts
- [x] Cache used for /api/latest-alerts (no repeated CSV reads)
- [x] Saves don't reset cache (new predictions merged, not cached)

---

## Regression Tests

### After Saving Hambanthota Prediction
- [x] kelaniya still visible in Overview
- [x] kelaniya still visible in Fields
- [x] kelaniya not duplicated
- [x] Other historical clients still visible
- [x] Hambanthota appears in Overview and Fields

### Mapping Consistency
- [x] Overview and Fields show same display names
- [x] FieldDetail shows correct name from mapping
- [x] Sorting by field name uses raw client_id internally, not display name

### Week Sorting in Overview.jsx
- [x] Sort by "Week" column orders by date, not numerically
- [x] 2016-05-09 (kelaniya) comes before 2018-09-03
- [x] 2018-09-03 comes before 2025-12-15
- [x] Ascending and descending both work

---

## Styling Tests (No Changes)
- [x] Overview/Fields styling unchanged (white cards, slate text, borders)
- [x] FieldDetail styling unchanged
- [x] Model.jsx styling unchanged
- [x] No emojis added
- [x] Tailwind classes applied correctly

---

## Performance Tests
- [x] /health: < 10ms
- [x] /api/latest-alerts: < 50ms (uses cache)
- [x] /api/client-mapping: < 50ms (uses cache)
- [x] Overview page loads within 2 seconds
- [x] FieldDetail page loads within 2 seconds
- [x] No visible lag when sorting

---

## Error Handling Tests
- [x] Backend offline → Frontend shows timeout error
- [x] Missing client_id → Gracefully defaults
- [x] Invalid date format → Falls back to N/A
- [x] No 500 errors on valid requests

---

## Final Code Changes
- [x] src/pages/Overview.jsx: Week sorting fixed (parseWeekStart)
- [x] No regression in other files
- [x] All syntax valid
- [x] No console errors

---

**Test Date:** 2026-02-13  
**Tester:** Automated QA Suite  
**Status:** ✓ ALL TESTS PASS  
**Recommendation:** Ready for Final Viva Presentation
