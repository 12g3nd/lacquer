# Migration from Pear

Lacquer uses a "shared session continuity" strategy. This means it intentionally uses the exact same `userData` directory (`%APPDATA%\YouTube Music`) as Pear.

## What this means for you
- **No re-login required:** If you are signed into Pear, you are automatically signed into Lacquer.
- **Shared settings:** Plugin configurations, window size, and most options are shared. If you enable a plugin in Lacquer, it will be enabled if you open Pear.
- **Legacy themes:** Lacquer automatically ignores `.local-reference` custom CSS themes that were loaded in Pear, so it won't break its own internal aesthetic styling.

## Safely trying Lacquer
Since the data is shared, you can safely trial Lacquer without uninstalling Pear. If you decide to go back, simply close Lacquer and open Pear.
