# Media – Tab Background Images

Place your background photos here. Each tab maps to a specific filename.

| Tab | Expected file |
|---|---|
| Dashboard | `bg-dashboard.jpg` |
| Run Analysis | `bg-run.jpg` |
| Bike Analysis | `bg-bike.jpg` |
| Swim Analysis | `bg-swim.jpg` |
| Athlete | `bg-athlete.jpg` |
| Planner | `bg-planner.jpg` |
| Gear | `bg-gear.jpg` |
| Activities | `bg-activities.jpg` |
| Calendar | `bg-calendar.jpg` |
| Weather | `bg-weather.jpg` |
| Map | `bg-map.jpg` |
| Wrapped | `bg-wrapped.jpg` |
| AI Coach | `bg-ai-chat.jpg` |

## Tips
- Any common format works: `.jpg`, `.png`, `.webp`
- Landscape orientation works best (16:9 or wider)
- The image is covered by a semi-transparent white overlay so content remains readable.
  Adjust `--tab-bg-overlay` in `styles/style.css` to change opacity (0 = full image, 1 = no image).
- Run, Bike, and Swim background images coexist with the per-sport CSS variables
  defined on `:root` in `styles/style.css`: `--sport-run-color`, `--sport-bike-color`,
  `--sport-swim-color`. Chart containers inside `#analysis-tab`, `#bike-tab`, and
  `#swim-tab` pick up those colors automatically, so pick photos whose tone does not
  clash with the matching sport accent.
