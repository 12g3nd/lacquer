# Release Checklist

When cutting a new release of Lacquer:
1. Ensure all `pnpm check` and tests pass.
2. Ensure you have run `pnpm dist:win` locally to test the Windows build.
3. Update version in `package.json`.
4. Run `pnpm changelog` to update the changelog (or write release notes manually).
5. Push to a release branch.
6. Trigger the GitHub Action (if configured) or manually upload the `pack/` artifacts to a GitHub Release.
7. Verify that the `Lacquer Setup x.x.x.exe` is present on the Release page.
