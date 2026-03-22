# GRUDA Legion SDK

Client libraries for the GRUDA Legion AI Hub at `ai.grudge-studio.com`.

Three usage modes:
- **Browser** — `GrudaLegion` class via `<script>` tag
- **Browser + Puter.js** — `PuterLegion` class with KV caching, FS storage, and Puter AI fallback (User Pays Model)
- **Node.js** — `GrudaLegionNode` for Express/backend services

## Quick Start

### Browser (standalone)

```html
<script src="https://cdn.jsdelivr.net/gh/MolochDaGod/gruda-legion-sdk@main/src/legion.js"></script>
<script>
  const legion = new GrudaLegion({ apiKey: 'YOUR_KEY' });
  legion.chat('Hello from Grudge Studio!').then(r => console.log(r.response));
</script>
```

### Browser + Puter.js (recommended for Grudge apps)

```html
<script src="https://js.puter.com/v2/"></script>
<script src="https://cdn.jsdelivr.net/gh/MolochDaGod/gruda-legion-sdk@main/src/legion.js"></script>
<script src="https://cdn.jsdelivr.net/gh/MolochDaGod/gruda-legion-sdk@main/src/puter-legion.js"></script>
<script>
  const ai = new PuterLegion({
    apiKey: 'YOUR_KEY',
    puterFallback: true,   // Puter AI fallback (user pays)
    enableCache: true,     // Cache in Puter KV
  });

  // Chat with automatic fallback chain: cache → Legion → Puter AI
  ai.lore('Write a quest about a cursed island').then(r => {
    console.log(r.response);  // AI text
    console.log(r.source);    // 'legion' | 'puter-fallback' | 'cache'
  });

  // Save/load player data via Puter KV
  await ai.saveData('player_stats', { level: 10, class: 'warrior' });
  const stats = await ai.loadData('player_stats');
</script>
```

### Node.js

```js
const { GrudaLegionNode } = require('gruda-legion-sdk');

const legion = new GrudaLegionNode({ apiKey: process.env.LEGION_HUB_API_KEY });
const reply = await legion.chat('Review this code for bugs');
console.log(reply.response);
```

## Agent Roles

All clients provide shortcut methods for each agent role:

```js
await legion.dev('Review this combat formula');      // Code review
await legion.balance('Is warrior DPS too high?');    // Game balance
await legion.lore('Write NPC dialogue for a smith'); // Lore writing
await legion.art('Voxel dark knight sword model');   // 3D art prompts
await legion.mission('Generate a raid quest');        // Mission design
await legion.companion('Greet the player in combat'); // Gouldstone AI
await legion.faction('Recommend missions for pirates'); // Faction intel
```

Or use the generic `agent()` method:

```js
await legion.agent('lore', 'Describe the Pirate King fortress');
```

## API Reference

### `GrudaLegion` / `GrudaLegionNode`

| Method | Description |
|--------|-------------|
| `chat(message, options?)` | General chat |
| `agent(role, message, options?)` | Role-specialized chat |
| `conversation(messages[], options?)` | Multi-turn chat |
| `generateImage(prompt, options?)` | Stable Diffusion XL image |
| `embed(text)` | BGE text embeddings |
| `listAgents()` | List available agent roles |
| `health()` | Health check |
| `dev/balance/lore/art/mission/companion/faction(msg)` | Role shortcuts |

### `PuterLegion` (extends above with Puter.js)

| Method | Description |
|--------|-------------|
| `chat(message, {role, cache})` | Chat with Legion → Puter fallback chain |
| `generateImage(prompt)` | Image gen with Puter txt2img fallback |
| `saveData(key, value)` | Save to Puter KV (prefixed `grudge_`) |
| `loadData(key)` | Load from Puter KV |
| `deleteData(key)` | Delete from Puter KV |
| `listData()` | List all `grudge_*` keys |
| `saveAsset(filename, data)` | Save to Puter FS (`GRUDA/assets/`) |
| `loadAsset(filename)` | Read from Puter FS |
| `isSignedIn()` | Check Puter auth |
| `signIn()` | Trigger Puter sign-in |
| `getUser()` | Get Puter user info |

### Admin API (requires admin-scoped key)

| Method | Description |
|--------|-------------|
| `usage(hours?, role?)` | Usage analytics |
| `adminHealth()` | Provider diagnostics |
| `getConfig()` | Get all role configs |
| `updateConfig(role, updates)` | Update a role's model/prompt/etc |

## Architecture

```
Grudge App (browser)
    │
    ├─ PuterLegion SDK
    │   ├─ Check Puter KV cache
    │   ├─ Call ai.grudge-studio.com (Workers AI)
    │   │   └─ Auto-escalates to VPS ai-agent (Anthropic/OpenAI/DeepSeek)
    │   └─ Fallback: Puter AI (User Pays Model — GPT/Claude/Gemini)
    │
    ├─ Puter KV — player data, response cache
    ├─ Puter FS — generated assets, saved files
    └─ Puter Auth — user identity
```

## Links

- **AI Hub**: https://ai.grudge-studio.com/health
- **Worker**: https://grudge-ai-hub.grudge.workers.dev
- **Hub Repo**: https://github.com/MolochDaGod/grudge-ai-hub
- **Puter.js Docs**: https://developer.puter.com
- **Grudge Studio**: https://grudge-studio.com

## License

MIT — Created by Racalvin The Pirate King, Grudge Studio
