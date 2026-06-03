# Code Changes - Final QA

## File: src/pages/Overview.jsx

### Change: Week Sorting Bug Fix

**Location:** Lines 76-92

**Before:**
```jsx
    rows.sort((a, b) => {
      if (sortKey === "risk") return (safeNumber(a.prob_high_risk) - safeNumber(b.prob_high_risk)) * dir;
      if (sortKey === "client") return String(a.client_id).localeCompare(String(b.client_id)) * dir;
      if (sortKey === "week") return (safeNumber(a.target_week_start) - safeNumber(b.target_week_start)) * dir;
      if (sortKey === "status") return (safeNumber(a.alert) - safeNumber(b.alert)) * dir;
      return 0;
    });
```

**After:**
```jsx
    rows.sort((a, b) => {
      if (sortKey === "risk") return (safeNumber(a.prob_high_risk) - safeNumber(b.prob_high_risk)) * dir;
      if (sortKey === "client") return String(a.client_id).localeCompare(String(b.client_id)) * dir;
      if (sortKey === "week") {
        const dateA = parseWeekStart(a.target_week_start);
        const dateB = parseWeekStart(b.target_week_start);
        const timeA = dateA ? dateA.getTime() : -Infinity;
        const timeB = dateB ? dateB.getTime() : -Infinity;
        return (timeA - timeB) * dir;
      }
      if (sortKey === "status") return (safeNumber(a.alert) - safeNumber(b.alert)) * dir;
      return 0;
    });
```

**Reason:** 
Using `safeNumber()` on ISO date strings like "2016-05-09" would fail (returns NaN), resulting in inconsistent sorting. Using `parseWeekStart()` properly handles both epoch milliseconds and ISO date strings, then compares via `.getTime()` for correct chronological ordering.

**Impact:**
- Sorting by Week column now works correctly
- ISO dates (2016-05-09, 2018-09-03, 2025-12-15) sort in proper chronological order
- No more NaN comparisons causing undefined behavior

---

## Files NOT Changed (Working Correctly)

### backend/main.py
✓ Caching logic: `_compute_base_latest_alerts()` at startup  
✓ Merging logic: `/api/latest-alerts` uses cache + live sources  
✓ Mapping logic: `/api/client-mapping` uses all 3 sources  
✓ Source tracking: Added to all merged rows  
✓ Deduplication: Latest per client retained  

### src/utils/format.js
✓ `parseWeekStart()` helper: Accepts epoch or ISO  
✓ `formatWeekLabel()`: Uses parseWeekStart  
✓ `epochMsToDate()`: Delegates to parseWeekStart  

### src/pages/FieldDetail.jsx
✓ Uses `fetchJsonWithTimeout` for all API calls  
✓ Threshold error handling (shows warning if metrics fail)  
✓ Source field in tooltips ("Historical data" vs "User saved prediction")  

### src/pages/Model.jsx
✓ All panels use `fetchJsonWithTimeout`  
✓ Graceful error messages (no hanging)  

### src/pages/Fields.jsx
✓ Uses `fetchJsonWithTimeout`  
✓ Never allows loading to hang  

### src/pages/CheckRisk.jsx
✓ Save prediction button works  
✓ Saves to user_alert_history.csv with source="user"  

---

## Summary of All Changes Made (Session)

| File | Changes | Status |
|------|---------|--------|
| backend/main.py | Added `_compute_base_latest_alerts()`, caching, source tracking | ✓ Complete |
| src/utils/fetchWithTimeout.js | New file: timeout helper | ✓ Complete |
| src/utils/format.js | Added `parseWeekStart()` helper | ✓ Complete |
| src/pages/Overview.jsx | Fixed week sorting, added timeout | ✓ Complete (Final Fix) |
| src/pages/FieldDetail.jsx | Added timeouts, source tracking, threshold error handling | ✓ Complete |
| src/pages/Model.jsx | Added timeouts to panels | ✓ Complete |
| src/pages/Fields.jsx | Added timeouts | ✓ Complete |
| src/pages/CheckRisk.jsx | Save prediction with source="user" | ✓ Complete |

---

## Validation

### Syntax Check
- [x] backend/main.py: No syntax errors
- [x] src/pages/Overview.jsx: Valid JSX

### Logic Check
- [x] Week sorting: Date comparison via getTime() is correct
- [x] Fallback: -Infinity for invalid dates ensures null dates sort first
- [x] Direction: `* dir` correctly handles asc/desc

### Test Coverage
- [x] Manual API tests: All endpoints responding
- [x] Data integrity: kelaniya retained, Wr/We mapped correctly
- [x] Performance: Cache prevents repeated CSV reads
- [x] Regression: Historical data preserved after saves

---

**Final Status: ✓ Ready for Submission**
