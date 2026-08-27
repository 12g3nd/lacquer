---
description: Workflow for preventing UI regression.
---

# Lacquer UI Regression

Validate the current Lacquer UI changes in the running application.

1. Build or launch the appropriate development version.
2. Inspect the feature that changed and its surrounding UI.
3. Capture representative screenshots where useful.

Test relevant states from this matrix:

- maximized window;
- normal resizable window;
- narrower supported window;
- top of page;
- partially scrolled page;
- deeply scrolled page;
- Home view;
- playlist or album view;
- active playback;
- long titles or metadata;
- dark album artwork;
- bright album artwork;
- highly saturated album artwork.

Check specifically for:

- clipped text;
- sticky-header collisions;
- content hidden behind navigation;
- unintended overflow;
- layout jumps;
- displaced artwork;
- unreadable contrast;
- broken hit targets;
- incorrect z-index layering;
- album-reactive background failures;
- visual regressions outside the changed feature.

Use bounded validation:

1. one complete inspection pass;
2. one batched correction pass if defects are found;
3. one confirmation pass.

Do not enter an open-ended visual-polishing loop.

Report:
- states tested;
- defects found;
- fixes made;
- remaining known issues.