# Install OpenGlassUI on a computer

Download the installer for your machine from [GitHub Releases](https://github.com/weisser-dev/openglassui/releases/latest).

| Computer | Installer |
| --- | --- |
| Mac with Apple silicon (M-series) | `OpenGlassUI-<version>-mac-arm64.dmg` |
| Intel Mac | `OpenGlassUI-<version>-mac-x64.dmg` |
| Windows x64 | `OpenGlassUI-<version>-win-x64.exe` |

On macOS, open the disk image, drag OpenGlassUI into **Applications**, and open it there. On Windows, run the EXE and launch OpenGlassUI from the Start menu. The initial builds use ad hoc signing on macOS and are unsigned on Windows. macOS Gatekeeper or Windows SmartScreen can block or warn about these downloads.

The app includes the local runtime and dashboard. Install and sign in to the coding agent you want to use. Select your project, configure an HTTPS connection and pair your glasses in the dashboard. A Windows Codex installation from the upstream npm package can use its bundled native `codex.exe`. For custom Windows agents, configure a native executable. To use an external Tailscale connection, start `tailscale funnel --bg http://127.0.0.1:4174` in an Administrator terminal and enter the HTTPS hostname in OpenGlassUI. Only the paired-device gateway on port 4174 belongs behind a tunnel.

Close the dashboard window to keep the companion running in the menu bar or Windows notification area. Use **Start at login** there to start it in the background on login. Use **Quit OpenGlassUI** to shut it down.

## Existing desktop chats

Both platforms can run their local agents and use the glasses dashboard. Sending directly into an already-open Codex Desktop or Claude Code Desktop chat currently requires a Mac running that desktop client. Claude's macOS sender is experimental and requires Accessibility access. See [shared sessions and live input](../README.md#shared-sessions-and-live-input) for details.

For the installed macOS app, run the existing Claude helper setup with the npm companion or a source checkout using the same `OPENGLASS_DATA_DIR` as the desktop app. The default is `~/.openglassui`.

## Updates and local data

Use **Check for Updates** in the menu bar or notification area. Early builds will open GitHub Releases when you choose to download a newer version. Install the new DMG or EXE over your existing application after quitting it. The app keeps configuration, projects and pairing data in `~/.openglassui` outside the installation directory. A stable HTTPS hostname lets paired glasses keep their saved address.

If you previously ran `node server.js` from a checkout, your data may instead be in `.openglass` inside the checkout. Stop the old process before opening the installed app. Back up both locations and migrate the old data and configuration into the installed app's data directory, or launch the installed app with the same `OPENGLASS_DATA_DIR` and `OPENGLASS_CONFIG` paths. The npm CLI already uses the same default data directory as the app. A companion already using ports 4173 and 4174 must be stopped before starting a second one.

## Maintainer releases

Run `npm ci` on Node 24 and use `npm run desktop:build` on the target OS. On macOS use the matching architecture for each build so the agent SDK includes the corresponding native binary. The GitHub Actions **Desktop installers** workflow builds the installers and checks that each packaged companion can run a task. Run it on `main` with **Publish installers** enabled, or push a new `v<version>` tag matching `package.json`. The release includes the installers and the update metadata for both platforms.

To enable in-app update installation on macOS, set the repository variable `DESKTOP_SIGN_MAC=1` and provide the Developer ID Application certificate via `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD`. Add `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` for notarization. On Windows set `DESKTOP_SIGN_WINDOWS=1` and configure `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` for a compatible Authenticode signing certificate. Signing keys belong in GitHub Actions secrets. Existing ad hoc or unsigned installs should be replaced manually with the first signed build. Subsequent signed builds can download and install updates **after the user confirms**. See [electron-builder auto-updates](https://www.electron.build/v26/docs/features/auto-update/).
