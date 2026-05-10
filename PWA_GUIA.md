# Complete guide to tabs, stats, charts, filters, and views

This document describes, tab by tab, everything currently shown by the application: filters, statistics, visualizations, and user actions.

## 0) Shared app foundation

### Authentication

- Login with Strava OAuth 2.0.
- Access token and refresh token stored in localStorage.
- Automatic token refresh in backend.

### Data sources

- Activities: paginated list from Strava.
- Athlete profile.
- Training zones.
- Gear details.
- Activity streams for detailed views.

### Local cache

- Athlete, zones, gear: longer TTL (24h).
- Activities: shorter TTL (1h).

## 1) Dashboard

### Filters

- Nine preset time-range buttons: This Week, Last 7 Days, This Month, Last 30 Days, Last 3 Months, Last 6 Months, This Year, Last 365 Days, All Time.
- Custom From and To date pickers (DD/MM/YYYY text inputs) plus an Apply button. The custom range is dashboard-local and does not propagate to other tabs.

### Stats and KPIs

- Total number of activities.
- Total distance.
- Total moving time.
- Longest activity.
- Sport mix.
- CTL (fitness), ATL (fatigue), TSB (freshness), injury risk, 7-day rolling load.
- Annual/monthly goal progress (distance, hours, or activity count).

### Charts and views

- Acute Load Chart with productive-range band. The band mode is hardcoded to `'aggressive'`.
- Consistency heatmap (calendar).
- Load time series (CTL/ATL/TSB/risk).
- Goal progress chart.

### Actions

- Apply filters.
- Change range presets or enter a custom date range.
- Edit goals (km, hours, or activities target).

## 2) Run

### Filters

- From/to date.
- Shoe filter (gear).
- Apply and reset filters.

### Stats and KPIs

- Total runs.
- Total distance.
- Total time.
- Total elevation.
- Average run distance.
- Average pace.
- Average and max HR.
- Min/max/average speed.

### Charts and views

- Activity-type bars (trail, long run, race, intensity).
- Monthly distance (with session frequency).
- Pace vs distance scatter.
- Distance histogram.
- Elevation histogram.
- Distance vs elevation scatter.
- Accumulated distance.
- Weekly rolling-mean trend.
- Consistency heatmap.
- Runs heatmap map.
- Top runs.
- Monthly shoe-usage Gantt.
- Sortable activities table.

### Actions

- Sort columns.
- Open activity detail.
- Apply/reset date and gear filters.

## 3) Bike Analysis

### Filters

- From/to date.
- Bike filter (gear selector across all known bike gears).
- Year shortcut buttons.
- Apply and reset filters.

### Stats and KPIs

- Total rides.
- Total distance, total moving time, total elevation gain.
- Average ride distance.
- Average speed (km/h).
- Average cadence.
- Average power (watts) where available.
- Average HR.
- Summary card per bike type: road, mtb, gravel, indoor, electric — distance, time, elevation, count.

### Charts and views

- Bike-type distribution pie chart.
- Distance histogram.
- Elevation histogram.
- Speed-vs-distance scatter.
- Distance-vs-elevation scatter.
- Elevation-ratio chart (m / km).
- Power-vs-speed scatter for rides with power data.
- Accumulated distance line.
- Weekly rolling-distance trend.
- Consistency heatmap (Cal-Heatmap style).
- Eddington distribution and Eddington progression charts.
- Top rides ranking.
- Sortable activities table with date, sport, name, distance, time, speed, elevation, power, HR, TSS.

### Actions

- Filter by date range, bike, or quick year.
- Sort the activities table by any column.
- Open an activity row to jump to the detail page.

## 4) Swim Analysis

### Filters

- From/to date.
- Year shortcut buttons.
- Apply and reset.

### Stats and KPIs

- Total swims.
- Total distance and total time.
- Average session distance.
- Average pace per 100 m.
- Average HR.
- Pool vs open-water comparison: count, distance, average session time.
- Pool length estimation (matched against common metric and yard pool sizes).

### Charts and views

- Distance histogram.
- Pace histogram.
- Pace-vs-distance scatter colored by pool/open water.
- Pace/HR curve and efficiency-evolution chart.
- Volume-improvement chart.
- Accumulated distance line.
- Weekly rolling-distance trend.
- Consistency heatmap.
- Pool-length chart for indoor swims.
- Eddington distribution and progression.
- Top swims ranking.
- Swims table with date, name, distance, time, pace/100m, type, pool length, HR.

### Actions

- Filter by date range or year.
- Sort the swims table.
- Open a swim row to navigate to the activity detail page.

## 5) Athlete

### Filters

- Sport filter.
- Data type selector (time, count, distance).
- From/to date.

### Stats and KPIs

- Athlete profile (name, location, followers, friends).
- All-time totals (activities, distance, time, elevation).
- Records: longest run, fastest run, most elevation.
- Time preferences: favorite day and favorite hour.
- Average distance and average pace.
- Solo vs group workouts.
- Training zones (HR and power).

### Charts and views

- Start-time histogram.
- Duration histogram.
- Yearly comparison (bars).
- Weekly and monthly mix.
- Time matrices (hour x day, year x month, month x day, etc.).
- Interactive matrix.

### Actions

- Change sport/data type and time range.

## 6) Planner (Predictor)

### Filters/inputs

- Base distance and reference time.
- Model-weight sliders for Riegel, VDOT, direct PB matching, and personal curve fitting.
- Scenario selector: conservative / moderate / aggressive.
- Chart distance selector for the prediction evolution view.

### Stats and calculations

- Personal bests at standard distances (5K, 10K, half marathon, marathon, etc.).
- Top historical efforts per distance bracket.
- Riegel formula (`T2 = T1 × (D2 / D1)^1.06`).
- VDOT-style transfer.
- Personal curve fit across the user's PB history.
- Final blended prediction using the user-controlled weights.
- Training readiness summary derived from recent load.

### Charts and views

- PB table.
- Prediction table with target time, pace, and confidence margin.
- Prediction-evolution chart showing how the model output drifted over time.
- Training readiness section.

### Actions

- Adjust model weights and recalculate.
- Switch scenario (conservative / moderate / aggressive).
- Change the chart-distance focus.

## 7) Gear

### Filters

- Sort by last use, distance, health, or name.

### Stats and KPIs

- Total distance by gear.
- Number of uses.
- First and last use dates.
- Average distance per use.
- Average pace by gear.
- Health percentage (usage vs expected lifetime).

### Charts and views

- Gear list with metrics.
- Distance-by-gear chart.
- Monthly gear-usage Gantt.
- Gear detail view (model, brand, price, durability).

### Actions

- Open detail.
- Edit custom fields (price, expected durability).
- Delete custom configuration.

## 8) Activities

### Filters

- Sport (multi-select).
- Name text filter.
- Date range.
- Distance range.
- Duration range.
- HR range.
- TSS range.

### Stats and views

- Universal table with columns:
  - Date, hour, sport, name.
  - Distance, duration, pace/speed.
  - Average/max HR.
  - Elevation, cadence, power, TSS.

### Actions

- Sort by any column.
- Open activity detail from activity name.

## 9) Calendar

### Filters

- View mode: Week, Month, Year.
- Activity type multi-select (sports present in the data).
- Year navigation through prev/next buttons and a Today shortcut.

### Stats and KPIs

- Current and longest day streak.
- Current and longest week streak.
- Activities in the selected period.
- Total distance.
- Total moving hours.
- Active days.
- Total TSS.

### Charts and views

- Annual calendar heatmap colored by selected sport.
- Per-day activity tiles colored by sport with name, distance, and duration.
- Streak summary card.
- Activities list grouped by date for the selected window.

### Actions

- Switch between week, month, and year views.
- Navigate prev/next or jump back to Today.
- Filter the visible activity types.
- Click an activity to open its detail page.

## 10) Weather

### Filters

- Histogram variable selector (temperature, rain, wind, humidity, clouds, pressure).

### Stats and KPIs

- Average temperature.
- Average wind.
- Average humidity.
- Total rain.
- Most common weather condition.
- Most common wind direction.
- Average pressure.
- Estimated environmental difficulty.

### Charts and views

- Monthly multi-variable overview.
- Weather conditions pie chart.
- Temperature vs pace scatter.
- Histogram of selected variable.
- Weather-per-activity table.

### Actions

- Change histogram variable.

## 11) Maps

### Filters

- Sport selector.
- Visualization mode (density heatmap or route polylines).
- Map tile provider (OpenStreetMap, Carto Light/Dark, satellite, etc.).
- From/to date range.
- Heatmap intensity, radius, and blur sliders.
- Color-by-sport toggle for the routes mode.

### Stats and views

- Full-screen Leaflet map with two render modes:
  - Density heatmap using Leaflet.heat over decoded route points.
  - Route polylines decoded client-side from each activity's `map.summary_polyline`.
- Hover/click popups with activity name and date.

### Actions

- Switch between heatmap and route modes.
- Change the tile layer.
- Apply the sport or date filters and re-render the layer.
- Tune heatmap parameters live.
- Click a route to open its activity detail page.

## 12) Report (Wrapped)

### Filters

- Year selector.

### Stats and KPIs

- Distance, time, elevation, activities, active days.
- Longest activity, average distance, most active month.
- Year-over-year changes (percent).
- Current and longest streaks.
- Sport highlights.

### Charts and views

- Monthly volume.
- Sport distribution pie chart.
- Year comparison.
- Top weeks.
- Monthly heatmap.

### Actions

- Change report year.
- Export/print summary.

## 13) AI Chat (Coach)

### Inputs

- User-provided Gemini API key (stored in `localStorage('gemini_api_key')`).
- Free-form chat prompt.
- Starter suggestion buttons rendered above the input.

### Context used by the assistant

- Global training summary (totals, active days, sport mix).
- Sport breakdown.
- PB-like stats from the historical run catalog.
- Gear summary including current health for shoes and bikes.
- Recent activities and recent monthly volume series.

### Views

- Persistent chat transcript stored in `localStorage('ai_chat_history')`.
- Distinct styling for user and assistant messages.
- API-key entry banner shown until a key is configured.

### Actions

- Enter or update the Gemini API key.
- Click a starter suggestion to seed the prompt.
- Send a prompt; the request is made browser-side directly against the Gemini Flash preview endpoint.
- Clear chat history.

## Cross-app settings

Global settings panel with:

- Metric/imperial units.
- Age.
- Max HR.

These preferences affect unit conversion and HR-dependent calculations.

## Exports

- Global CSV export from header.
- PDF print through browser.

## Quick guide

If you want training control and consistency, use Dashboard and Calendar.
If you want deep sport-specific analysis, use Run/Bike/Swim.
If you want planning support, use Predictor and AI Coach.
If you want year-end retrospective, use Report.
