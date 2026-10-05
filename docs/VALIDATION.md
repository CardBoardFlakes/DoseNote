# Validation of the local deliverable

Validated on macOS 15.6, Apple silicon, on 5 October 2026.

- Eight application logic/storage tests passed: independent doses and undo, local calendar-day rollover, selected weekdays, as-needed checkoffs, history preservation on edit/removal, input and backup validation, restart persistence, and failure to write data.
- The actual Electron UI passed add/edit/remove, removal cancellation, separate doses, undo, relaunch persistence, history preservation, selected-day validation, text rendering safety, backup export, restore cancellation, and confirmed restore. Native dialog responses were supplied by the test; app handlers and filesystem writes were exercised.
- README screenshots were captured from the actual desktop app using isolated fictional data.
- JavaScript syntax checks passed. Both GitHub workflow files parse as YAML, and package versions match the lockfile.
- The Mac arm64 application and drag-to-Applications DMG were built. The packaged application launched successfully, showed a blank first-run checklist and working Settings form, and exposed only its restricted preload API to the renderer. The DMG passed `hdiutil verify`.
- `npm audit --omit=dev` reported zero vulnerabilities. Full `npm audit` reports eight high-severity findings in the build tool’s transitive HTTP caching dependencies. These development dependencies are excluded from the packaged app. The latest stable electron-builder was retained; npm’s suggested older version increased the findings. Review the build dependency audit again before publishing.

Not verified here: Windows, Linux, Intel Mac installation, GitHub Actions execution, Developer ID signing/notarization, or Windows signing. The local Mac download is an unsigned test build. Release instructions describe the remaining public distribution steps.
