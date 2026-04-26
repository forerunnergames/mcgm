# MCGM — Minecraft Game Master

An AI-powered Minecraft bot that joins your server as a player and acts as an autonomous game master. Chat with it in-game or from your phone, and it builds structures, spawns entities, equips players, teleports to biomes/structures, converts terrain, and more — all through natural language.

## Architecture

```
Phone (web UI) ──HTTP──► Node.js bot
                          ├─ Claude Sonnet (LLM brain + tool dispatch)
                          ├─ Pterodactyl panel API (server commands)
                          └─ Go transport (gophertunnel → Geyser → Paper)
```

- **Go transport** (`transport/`): Connects to the server via Bedrock protocol through Geyser using [gophertunnel](https://github.com/sandertv/gophertunnel). Handles Microsoft auth, RakNet, chat I/O.
- **Node.js bot** (`bot.js`): Orchestrates the LLM, tools, web UI, and transport subprocess.
- **LLM brain** (`llm.js`): Routes chat to Claude with tool definitions. Manages conversation history.
- **High-level tools** (`tools.js`): `equip_player`, `replace_blocks_in_area`, `locate_and_teleport`, `plant_trees`, `place_structure`, `scan_area` — handle all Minecraft complexity (chunk loading, block tags, enchantment syntax, etc.) so the LLM just picks the right tool.
- **Server API** (`server/api.js`): Wraps the Pterodactyl panel `/command` endpoint. Auto-tiles oversized fills, fuzzy-matches block names, validates against the block registry.
- **Web UI** (`webui.js`): Mobile-first chat interface on LAN. Parallel request support.
- **Reference data** (`minecraft-reference.json`): 1166 blocks, 1505 items, 221 features, 34 structures, 65 biomes — extracted from the Paper 26.1.1 jar.

## Setup

### Prerequisites

- Node.js 22+ (via nvm)
- Go 1.26+ (for building the transport)
- A Minecraft server running Paper 26.1.1+ with Geyser + Floodgate
- A Pterodactyl panel API key for the server
- An Anthropic API key
- A Microsoft account with Minecraft + 2FA enabled (for the bot's identity)

### Install

```bash
# Install Node dependencies
nvm use 22
npm install

# Build the Go transport
cd transport
go build -o bedrock-transport .
cd ..
```

### Configure

Copy `.env.example` to `.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
PANEL_API_KEY=ptlc_...
PANEL_API_BASE=https://panel.example.com/api/client
PANEL_SERVER_ID=your-server-id
SERVER_HOST=your-server-ip
SERVER_PORT=your-server-port
AUTHORIZED_OP=.your-bedrock-username
BOT_NAME=.your-bot-username
LLM_MODEL=claude-sonnet-4-6
WEB_UI_HOST=0.0.0.0
WEB_UI_PORT=3000
```

### Run

```bash
npm start
```

First run prompts for Microsoft device-code sign-in. Auth token is cached for ~90 days.

### Phone UI

Open `http://<your-lan-ip>:3000` on your phone (same WiFi network).

## License

MIT — see [LICENSE](LICENSE)
