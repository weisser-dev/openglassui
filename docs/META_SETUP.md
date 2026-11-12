# Meta Ray-Ban Display setup

This is an experimental development flow. Requirements and menu names can change with Meta AI app and glasses versions. Physical glasses, wristband, QR installation, and voice behavior have not yet been verified end to end by this project.

1. Install and sign in to the Meta AI app on the iPhone, pair the Meta Ray-Ban Display, and enable its developer mode according to Meta's current developer instructions.
2. On the computer or server running the agent, install Node.js 20 or newer and run `./setup.sh` (macOS/Linux) or `setup.bat` (Windows). The script can optionally offer installation of cloudflared through an available package manager. Configure `config.json` and run `npm start`.
3. Open `http://127.0.0.1:4173` on that computer. Add project names and absolute paths locally using **Projekt hinzufügen**. Only registered projects can be selected remotely.
4. Install `cloudflared`, or install and authenticate `ngrok` separately. In the local dashboard choose the provider and click **Tunnel starten**. Alternatively forward a supported HTTPS tunnel to `http://127.0.0.1:4174` (the gateway, not the admin port). The default gateway port can be changed using `OPENGLASS_GATEWAY_PORT`. Quick tunnels are temporary; ngrok free may display an interstitial and has request limits. Neither tunnel provider is operated by this project.
5. After the HTTPS address appears, generate a pairing QR. It is secret, single-use, and valid for five minutes. Scan it with the iPhone, follow Meta AI's web-app install flow, and open the app on the glasses before it expires. Meta's manual flow is documented as Devices → Display Glasses settings → App connections → Web apps → Add a web app; exact labels can change. The encoded Meta deep link must still be verified on real hardware.
6. Keep the computer and tunnel running. Open the app and use the band to navigate projects, agents, tasks, and decision controls. WebMCP and dictation depend on device support and availability; test with the actual glasses. Open-app status notices are implemented; background push is not verified.
7. From the local dashboard, revoke a device or disconnect all devices when necessary. A restarted companion keeps paired-device hashes but a temporary tunnel normally receives a new URL; how Meta restores the installed web-app URL on-device needs testing.

**Simulator:** open **Brillen-Simulator** from the dashboard. Click inside the frame; use arrow keys, Enter, Tab, and Escape. The simulator launches real local tasks and does not simulate hardware optics or guarantee gesture parity.

Official references: [Meta Wearables Web App Toolkit](https://github.com/meta/meta-wearables-webapp), [Meta WebMCP samples](https://github.com/meta/meta_glasses_webmcp), and [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
