# Baseline Evaluation

This document records the initial state of the Lacquer foundation run regarding automated checks and tests.

## pnpm check
The repository uses `oxlint` and `tsc` for checking. The upstream Pear Desktop code contains a number of pre-existing warnings and errors in `solid(reactivity)` and `typescript(no-misused-spread)`. 
These have been left unchanged to respect the `UPSTREAM_STRATEGY` of not mutating upstream code unnecessarily.

- Warnings: 17
- Errors: 0 (after fixing the `import(first)` and `perfectionist(sort-imports)` rules that were temporarily introduced).

## pnpm test
Playwright tests are present. 
- 5 tests pass successfully (mostly parsing tests).
- `Pear Desktop App - With default settings, app is launched and visible` times out after 30000ms.
  - **Note**: This is likely due to the headless execution environment or window rendering timeout on this specific machine/CI. This failure is recorded as inherited/environmental.
