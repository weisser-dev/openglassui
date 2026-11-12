# Agent clients and harnesses

OpenGlassUI connects wearable and desktop clients to an agent harness running on the companion computer. The harness owns provider authentication, models, project tools, session behavior and its own permissions. OpenGlassUI is a control surface and local adapter, not an LLM router or a replacement coding harness.

```text
Wearable / desktop -> OpenGlassUI companion -> agent adapter -> agent harness -> model provider
                                                |               |
                                                |               +-> project tools and MCP
                                                +-> ACP v1 for compatible agents
```

Codex, Claude Code, Kiro CLI and OpenCode keep their dedicated integrations. Other locally installed agents can be configured as ACP v1 stdio clients in setup. Provider-specific adapters and improvements can be contributed through pull requests; see the repository's current tests and implementation before adding a dependency.

## Internal adapter interface

`createAcpClient(agent)` in `agent-client.js` exposes the following internal interface:

- `run({workspace, prompt, sessionId?, model?, onSession, onText, onUsage, onEvent, onDecision, onModels, onDone})` starts a turn and returns a handle with `kill()`.
- `listSessions(workspace)` and `discoverSessions(workspace)` return sessions if the agent advertises session listing.
- `readSession(workspace, id)` loads a known session if the agent advertises loading.

This is an evolving internal JavaScript interface, not a stable external plugin SDK. Its command and arguments come from trusted local configuration and are executed with `shell: false`. Custom entries created in setup are stored in `.openglass/acp-agents.json`. Do not place secrets in command-line arguments.

The ACP implementation currently handles text, session creation/loading/listing where advertised, tool progress, cancellation and one-time permission options. It does not implement client filesystem/terminal RPCs, general authentication flows, all permission variants, images or arbitrary extensions. Agents requiring these capabilities may not work. Never assume a particular agent implements every protocol capability.

## Model selection

Codex uses its app-server model catalog and applies the selected model to the next turn. Claude Code uses the model catalog returned by its SDK when available. Kiro CLI V3, OpenCode and generic ACP agents may advertise a `model` select via ACP session configuration: OpenGlassUI displays only returned options, applies a selected value through `session/set_config_option` when the next turn starts, and checks the agent's returned current value. The list is not a guarantee of billing eligibility; agents may change capabilities or reject models. Model choice is currently available after a session has reported a catalog. Live switching of another client's active session is not supported.

## LiteLLM

LiteLLM can be configured within a compatible agent as a model gateway; it can route requests to multiple providers. The agent remains responsible for executing tools and managing sessions. OpenGlassUI does not install LiteLLM, configure its credentials or bypass provider access requirements. See the [LiteLLM gateway documentation](https://docs.litellm.ai/docs/simple_proxy) and the selected agent's own provider setup.

## Protocol references

- [Agent Client Protocol session configuration](https://agentclientprotocol.com/protocol/v1/session-config-options)
- [Kiro CLI V3 ACP migration](https://kiro.dev/docs/cli/v3/acp-migration/), including the change from `session/set_model` to advertised configuration options
- [OpenCode ACP support](https://opencode.ai/docs/cli/acp/)
- [KiroCrew's ACP notes](https://github.com/kirodotdev/KiroCrew/blob/main/docs/reference/kiro-cli/acp.md), useful as a reference; version-specific observations are not a compatibility guarantee
