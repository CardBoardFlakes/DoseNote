# Publishing releases

## Put the project on GitHub

Create an empty GitHub repository, then upload the contents of this project (including `.github/`). Do not upload `node_modules/`, `dist/`, private backups, or real medication data. `package-lock.json` is included for reproducible dependency installation.

You can upload through GitHub’s web interface, or use Git after replacing the example repository URL:

```sh
git init
git add .
git commit -m "Add DoseNote desktop app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Enable GitHub Actions for the repository. Push a version tag matching `package.json`:

```sh
git tag v1.0.0
git push origin v1.0.0
```

The release workflow runs unit tests, exercises the actual desktop UI on Linux, builds Mac arm64 and x64 disk images, a Windows x64 installer, and a Linux x64 AppImage. Once all jobs pass, it gathers the files, adds SHA-256 checksums, and creates a **draft GitHub Release**. Check the downloads on real machines, edit the release notes, then publish the draft. No release is automatically made public.

For a build without a release, run the workflow manually from **Actions → Build desktop downloads → Run workflow**. Download installers from the successful run’s artifacts. Downloaded artifacts are ZIP containers; extract them to find the installer.

Before a new version, change `package.json` and run `npm install --package-lock-only`. Keep the version tag and package version equal; the workflow validates this. The CI workflow checks pushes and pull requests without publishing.

## Signing for public downloads

Unsigned installers can be built without paid developer accounts. Public downloads for a nontechnical audience should be signed before publishing, particularly on macOS. The workflow uses electron-builder’s standard certificate and notarization environment variables when you supply them as GitHub repository **Actions secrets**.

Mac secrets:

- `MAC_CSC_LINK`: exported Developer ID Application certificate (`.p12`) as base64.
- `MAC_CSC_KEY_PASSWORD`: certificate password.
- `APPLE_ID`: Apple developer account email.
- `APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for notarization.
- `APPLE_TEAM_ID`: developer team ID.

Windows secrets:

- `WIN_CSC_LINK`: code-signing certificate (`.p12`) as base64, if your signing provider supports exported certificates.
- `WIN_CSC_KEY_PASSWORD`: certificate password.

Some Windows signing providers require a hardware token or cloud signing service instead of `.p12`; configure the builder for that provider before publishing. A signature does not guarantee that a new Windows app will immediately have SmartScreen reputation.

References: [electron-builder code signing](https://www.electron.build/code-signing.html), [macOS configuration and notarization](https://www.electron.build/mac.html), [Apple’s notarization guide](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

If signing secrets are absent, the workflow produces unsigned builds. Clearly label these as test builds. Do not tell users to disable their computer’s security protections. For your own trusted unsigned Mac test download, macOS may require approving it under **System Settings → Privacy & Security → Open Anyway**; public releases should avoid this by signing and notarizing.

## Release checklist

- Unit and UI checks pass.
- Install and launch each platform’s download on a real supported system.
- Confirm a fresh install contains no example or personal data.
- Add medication, check off a dose, quit, reopen, and verify it remains taken.
- Exercise selected weekdays and a new local calendar day.
- Save a backup, restore it, and verify medication details and checkoffs.
- Verify code signing and Mac notarization if configured.
- Keep screenshots, version, release notes, and supported systems accurate.
- Publish the draft only after reviewing the installers.

The bundled application includes its runtime. It needs no server, Python installation, or developer tools on the end user’s computer. Automatic updates are not configured; users install newer releases manually while retaining their app data.
