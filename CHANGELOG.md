# Changelog

Notable changes to OpenGlassUI are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-11-14

- Improve the dashboard, device management, pairing and setup layouts for small touchscreens.

- Render Markdown tables as narrow labelled rows and fenced code as readable blocks in the wearable view; add example content to the public demo.

- Improve wearable send feedback, post-dictation focus, approval focus and visibility above the composer. Refresh visible imported chats more frequently without unnecessary redraws.

- Remove the private Tailscale Serve provider, safely migrate existing settings, and allow temporary Cloudflare Quick Tunnels with a clear warning.
- Offer a high-contrast green pairing QR with a black-and-white fallback.

- Page imported histories, display validated embedded image attachments, and support optional Claude activity events.
- Add animated gesture illustrations to the wearable tour.

- Show locally counted suggestion activity for paired devices; indicate when speech and token metrics are unavailable.

- Monitor imported Claude Code and Codex histories in the background, present separate message bubbles, and group duplicate imports by provider session. External Claude approvals require the optional permission hook; other external approvals remain limited.

### Added

- Present slash-command entries as expandable commands with their origin, and show reply suggestions as a focused, swipeable bubble.

- Dashboard and demo language selectors and configurable reply-suggestion instructions.

- Choose an available Claude model and configure message and character limits for reply suggestions in dashboard settings.

- Hide recent chats locally via a directional action and restore them in settings.
- Generate optional, tool-free Claude reply suggestions from the latest exchange.

- Experimental opt-in Claude Code permission hook for imported local sessions.

- Show the last authenticated device activity and pairing date in the linked devices dashboard.

- Tailscale Funnel connection option and persistent external HTTPS origin for independently managed tunnels.

- A linked-device dashboard with a dedicated pairing action, device count and connection settings.
- Browser-controlled live glasses preview and a separate fictional dashboard demo.
- Local task-status charts and a wearable version indicator.

### Changed

- Request three reply suggestions in a validated JSON schema, using the user’s language.

- Align dashboard branding and header controls, simplify numeric context inputs, and allow larger suggestion-context limits.

- Refresh settings, device-preview and public-site styling with theme-aware scrollbars and clearer loading states.
- Include bounded recent tool activity when available and show animated progress during managed runs.

- Show each assistant response as one scrollable bubble and render common Markdown formatting safely on wearable displays.

- Replace dashboard task controls with project management and a chart of requests and successful completions from paired devices. Group connection settings and glasses guidance in a settings dialog.

- Discourage new Cloudflare Quick Tunnel selections because their addresses change on restart.

- Resolve provider titles for imported sessions and reduce internal system-reminder noise in displayed history.
- Use a black wearable background in dark themes for additive displays.

### Fixed

- Ignore Claude interruption markers when selecting a completed exchange for reply suggestions.

- Avoid counting older loaded messages as unread and read rendered text without Markdown markers.

- Reuse locally cached provider session titles to avoid temporary placeholder titles.

- Preserve unread message indicators across wearable app reloads and improve common Markdown formatting.

- Clear wearable notices when opening a chat and show new activity counts beside recent chats.

- Keep recent Claude conversation text visible even when the session contains many newer tool-only events. External interactive requests remain unavailable in read-only imports.

- Hide the wearable model control when the agent does not report selectable models, and refresh availability when a session reports its model catalog.

- Retry alignment of the newest chat message after the wearable host finishes its layout, without overriding later user navigation.

- Load the latest Claude session messages and explicitly scroll the wearable view to the focused message.
- Keep dictated drafts and update the Send control when a device composer changes text without sending an input event.
- Explain when a Codex conversation is already being written by another client.

## [0.1.1] - 2026-11-13

### Added

- A generic Agent Client Protocol integration for locally configured compatible agents.
- An npm command-line package and optional macOS login and tunnel startup.
- A wearable home screen prioritising pending decisions, active tasks and recent chats.
- Sectioned conversations, speaker labels, complete read-aloud and a direct shortcut to reply.

### Changed

- Improved directional navigation, decision controls, focus restoration and opening conversations at the latest message.
- Show Kiro's reported session status as a snapshot rather than verified live activity.
- Updated the interactive demonstration and installation documentation.

## [0.1.0] - 2026-11-12

### Added

- An experimental local companion and wearable interface for Codex, Claude Code, Kiro CLI and OpenCode.
- Project and session discovery, task conversations and supported agent decisions.
- Device pairing, tunnel setup, a glasses simulator, optional alerts and speech controls.
- English and German interface options, setup guidance and an interactive public demo.

[Unreleased]: https://github.com/weisser-dev/openglassui/commits/main/
[0.1.1]: https://www.npmjs.com/package/@weisser-dev/openglassui/v/0.1.1
[0.1.0]: https://www.npmjs.com/package/@weisser-dev/openglassui/v/0.1.0
