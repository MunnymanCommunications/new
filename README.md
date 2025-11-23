# HARVEY - Local AI Gift Hub

**H**elpful **A**ssistant **R**eady to **V**irtually **E**xcel **Y**ou

A self-contained, portable local AI assistant that runs entirely on your machine. Download once, run anywhere - no internet required after initial setup.

## Features

- **Fully Local & Private**: All processing happens on your machine
- **Self-Contained**: Auto-downloads Ollama, Gemma 27B model, and dependencies
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Network Accessible**: Access from any device via REST API, WebSocket, or web interface
- **Password Protected**: Secure authentication for all connections
- **Master Prompt System**: Customizable system prompt for consistent AI behavior
- **Portable**: Copy to a flash drive and run on any compatible computer

## Quick Start

### 1. Choose Your OS

Open `index.html` in your browser and select your operating system to download the appropriate setup script.

Or run directly:

**Windows:**
```batch
scripts\setup-windows.bat
```

**macOS:**
```bash
chmod +x scripts/setup-mac.sh && ./scripts/setup-mac.sh
```

**Linux:**
```bash
chmod +x scripts/setup-linux.sh && ./scripts/setup-linux.sh
```

### 2. Access Harvey

Once setup is complete, open your browser to:
- **Local**: http://localhost:3847
- **Network**: http://[your-ip]:3847

## Authentication

**Password**: `Harveylocalmodel01`

### REST API
Include the password in the `X-Harvey-Auth` header:
```bash
curl -X POST http://localhost:3847/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Harvey-Auth: Harveylocalmodel01" \
  -d '{"message": "Hello Harvey!"}'
```

### WebSocket
Include the password in the auth object:
```javascript
const socket = io('http://localhost:3847', {
    auth: { password: 'Harveylocalmodel01' }
});
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/info` | GET | No | Server information |
| `/api/status` | GET | No | System status |
| `/api/chat` | POST | Yes | Chat completion |
| `/api/chat/stream` | POST | Yes | Streaming chat |
| `/api/prompt` | GET/POST | Yes | Get/Set master prompt |
| `/api/conversations/:id` | GET/DELETE | Yes | Manage conversations |

## WebSocket Events

### Client -> Server
- `chat` - Send a message: `{ message: string, stream: boolean }`
- `clear_conversation` - Clear chat history
- `get_history` - Get conversation history

### Server -> Client
- `connected` - Connection established
- `chat_response` - Non-streaming response
- `chat_chunk` - Streaming chunk
- `chat_complete` - Stream complete
- `chat_error` - Error occurred
- `conversation_cleared` - History cleared
- `history` - Conversation history

## Project Structure

```
harvey-local-ai-gift-hub/
├── index.html              # OS selection landing page
├── package.json            # Node.js dependencies
├── config/
│   └── config.json         # Server configuration
├── server/
│   └── index.js            # Backend server
├── client/
│   ├── index.html          # Chat interface
│   ├── instructions.html   # Connection guide
│   ├── settings.html       # Settings page
│   ├── css/
│   │   └── style.css       # Styles
│   └── js/
│       └── chat.js         # Chat client
└── scripts/
    ├── setup-windows.bat   # Windows setup
    ├── setup-mac.sh        # macOS setup
    └── setup-linux.sh      # Linux setup
```

## Configuration

Edit `config/config.json` to customize:

```json
{
  "server": {
    "port": 3847,
    "host": "0.0.0.0"
  },
  "auth": {
    "password": "Harveylocalmodel01"
  },
  "ollama": {
    "host": "http://localhost:11434",
    "model": "gemma2:27b"
  },
  "harvey": {
    "masterPrompt": "Your custom system prompt..."
  }
}
```

## Requirements

- **RAM**: 16GB+ recommended for Gemma 27B
- **Storage**: ~20GB for model and dependencies
- **Node.js**: v18+ (auto-installed by setup scripts)
- **Ollama**: Latest version (auto-installed by setup scripts)

## Manual Installation

If the setup scripts don't work:

1. Install Node.js: https://nodejs.org/
2. Install Ollama: https://ollama.com/download
3. Pull the model: `ollama pull gemma2:27b`
4. Install dependencies: `npm install`
5. Start the server: `npm start`

## Running After Setup

Use the generated startup script:

**Windows:** Double-click `start-harvey.bat`

**macOS/Linux:** Run `./start-harvey.sh`

Or manually:
```bash
ollama serve &
npm start
```

## Changing the Password

1. Edit `config/config.json`
2. Change the `auth.password` value
3. Restart the server

## Troubleshooting

**"Connection refused"**: Make sure the server is running (`npm start`)

**"401 Unauthorized"**: Check your password in the `X-Harvey-Auth` header

**"Model not found"**: Download the model with `ollama pull gemma2:27b`

**"Ollama not running"**: Start Ollama with `ollama serve`

**Slow responses**: Gemma 27B requires significant RAM. Try a smaller model if needed.

## License

MIT License - Feel free to use, modify, and distribute.

---

**Harvey** - Your Helpful Assistant Ready to Virtually Excel You
