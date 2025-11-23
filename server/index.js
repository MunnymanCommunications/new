/**
 * HARVEY - Local AI Gift Hub Server
 * Helpful Assistant Ready to Virtually Excel You
 *
 * Main server entry point providing:
 * - REST API for chat completion
 * - WebSocket connection for real-time chat
 * - Static file serving for web client
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'config.json');
let config;

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    console.error('Failed to load config.json, using defaults');
    config = {
        server: { port: 3847, host: '0.0.0.0' },
        auth: { password: 'Harveylocalmodel01', headerName: 'X-Harvey-Auth', socketAuthField: 'password' },
        ollama: { host: 'http://localhost:11434', model: 'gemma2:27b', modelDisplayName: 'Google Gemma 27B' },
        harvey: {
            name: 'Harvey',
            fullName: 'Helpful Assistant Ready to Virtually Excel You',
            version: '1.0.0',
            masterPrompt: 'You are Harvey, a helpful AI assistant.'
        }
    };
}

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Store active conversations
const conversations = new Map();

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

const authenticate = (req, res, next) => {
    const authHeader = req.headers[config.auth.headerName.toLowerCase()];
    const authQuery = req.query.password;
    const authBody = req.body?.password;

    const providedPassword = authHeader || authQuery || authBody;

    if (providedPassword === config.auth.password) {
        next();
    } else {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing authentication. Provide password via X-Harvey-Auth header, query parameter, or request body.'
        });
    }
};

// Optional auth - allows request but marks as authenticated or not
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers[config.auth.headerName.toLowerCase()];
    const authQuery = req.query.password;

    req.isAuthenticated = (authHeader === config.auth.password) || (authQuery === config.auth.password);
    next();
};

// =============================================================================
// OLLAMA INTEGRATION
// =============================================================================

async function checkOllamaStatus() {
    try {
        const response = await fetch(`${config.ollama.host}/api/tags`);
        if (response.ok) {
            const data = await response.json();
            return {
                online: true,
                models: data.models || []
            };
        }
        return { online: false, models: [] };
    } catch (error) {
        return { online: false, error: error.message };
    }
}

async function chatWithOllama(messages, conversationId = null) {
    const systemMessage = {
        role: 'system',
        content: config.harvey.masterPrompt
    };

    const fullMessages = [systemMessage, ...messages];

    try {
        const response = await fetch(`${config.ollama.host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.ollama.model,
                messages: fullMessages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            message: data.message,
            conversationId: conversationId || uuidv4()
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function streamChatWithOllama(messages, onChunk, onDone) {
    const systemMessage = {
        role: 'system',
        content: config.harvey.masterPrompt
    };

    const fullMessages = [systemMessage, ...messages];

    try {
        const response = await fetch(`${config.ollama.host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.ollama.model,
                messages: fullMessages,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
        }

        let fullContent = '';
        const reader = response.body;

        reader.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) {
                        fullContent += json.message.content;
                        onChunk(json.message.content);
                    }
                    if (json.done) {
                        onDone(fullContent);
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        });

        reader.on('error', (error) => {
            onDone(null, error.message);
        });

    } catch (error) {
        onDone(null, error.message);
    }
}

// =============================================================================
// REST API ROUTES
// =============================================================================

// Public routes (no auth required)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/api/info', (req, res) => {
    res.json({
        name: config.harvey.name,
        fullName: config.harvey.fullName,
        version: config.harvey.version,
        model: config.ollama.modelDisplayName,
        endpoints: {
            chat: '/api/chat',
            stream: '/api/chat/stream',
            status: '/api/status',
            websocket: `ws://localhost:${config.server.port}`
        },
        authentication: {
            header: config.auth.headerName,
            socketField: config.auth.socketAuthField
        }
    });
});

app.get('/api/status', async (req, res) => {
    const ollamaStatus = await checkOllamaStatus();
    const modelAvailable = ollamaStatus.models?.some(m =>
        m.name.includes('gemma2:27b') || m.name.includes('gemma:27b')
    );

    res.json({
        harvey: {
            status: 'online',
            version: config.harvey.version
        },
        ollama: {
            status: ollamaStatus.online ? 'online' : 'offline',
            host: config.ollama.host,
            error: ollamaStatus.error
        },
        model: {
            name: config.ollama.model,
            displayName: config.ollama.modelDisplayName,
            available: modelAvailable,
            allModels: ollamaStatus.models?.map(m => m.name) || []
        },
        activeConnections: io.sockets.sockets.size
    });
});

// Protected routes (auth required)
app.post('/api/chat', authenticate, async (req, res) => {
    const { message, messages, conversationId } = req.body;

    if (!message && !messages) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Please provide either "message" (string) or "messages" (array)'
        });
    }

    // Build messages array
    let chatMessages;
    if (messages && Array.isArray(messages)) {
        chatMessages = messages;
    } else {
        // Get existing conversation or start new
        const existingMessages = conversations.get(conversationId) || [];
        existingMessages.push({ role: 'user', content: message });
        chatMessages = existingMessages;
    }

    const result = await chatWithOllama(chatMessages, conversationId);

    if (result.success) {
        // Store conversation
        chatMessages.push(result.message);
        conversations.set(result.conversationId, chatMessages);

        res.json({
            success: true,
            response: result.message.content,
            role: result.message.role,
            conversationId: result.conversationId,
            model: config.ollama.modelDisplayName
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error
        });
    }
});

app.post('/api/chat/stream', authenticate, async (req, res) => {
    const { message, messages } = req.body;

    if (!message && !messages) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Please provide either "message" (string) or "messages" (array)'
        });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chatMessages = messages || [{ role: 'user', content: message }];

    await streamChatWithOllama(
        chatMessages,
        (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        (fullContent, error) => {
            if (error) {
                res.write(`data: ${JSON.stringify({ error })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`);
            }
            res.end();
        }
    );
});

// Conversation management
app.get('/api/conversations/:id', authenticate, (req, res) => {
    const conversation = conversations.get(req.params.id);
    if (conversation) {
        res.json({ conversationId: req.params.id, messages: conversation });
    } else {
        res.status(404).json({ error: 'Conversation not found' });
    }
});

app.delete('/api/conversations/:id', authenticate, (req, res) => {
    if (conversations.has(req.params.id)) {
        conversations.delete(req.params.id);
        res.json({ success: true, message: 'Conversation deleted' });
    } else {
        res.status(404).json({ error: 'Conversation not found' });
    }
});

// Get/Set master prompt
app.get('/api/prompt', authenticate, (req, res) => {
    res.json({
        masterPrompt: config.harvey.masterPrompt
    });
});

app.post('/api/prompt', authenticate, (req, res) => {
    const { masterPrompt } = req.body;

    if (!masterPrompt) {
        return res.status(400).json({ error: 'masterPrompt is required' });
    }

    config.harvey.masterPrompt = masterPrompt;

    // Optionally save to config file
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error);
    }

    res.json({
        success: true,
        message: 'Master prompt updated',
        masterPrompt: config.harvey.masterPrompt
    });
});

// =============================================================================
// WEBSOCKET HANDLING
// =============================================================================

io.use((socket, next) => {
    const password = socket.handshake.auth?.password ||
                    socket.handshake.query?.password;

    if (password === config.auth.password) {
        socket.authenticated = true;
        next();
    } else {
        next(new Error('Authentication failed. Provide password in auth.password or query.password'));
    }
});

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Initialize conversation for this socket
    let socketConversation = [];

    socket.emit('connected', {
        message: 'Connected to Harvey',
        socketId: socket.id,
        model: config.ollama.modelDisplayName
    });

    // Handle chat messages
    socket.on('chat', async (data) => {
        const { message, stream = false } = data;

        if (!message) {
            socket.emit('error', { message: 'No message provided' });
            return;
        }

        socketConversation.push({ role: 'user', content: message });

        if (stream) {
            // Streaming response
            socket.emit('chat_start', { message: 'Starting response...' });

            await streamChatWithOllama(
                socketConversation,
                (chunk) => {
                    socket.emit('chat_chunk', { chunk });
                },
                (fullContent, error) => {
                    if (error) {
                        socket.emit('chat_error', { error });
                    } else {
                        socketConversation.push({ role: 'assistant', content: fullContent });
                        socket.emit('chat_complete', {
                            response: fullContent,
                            model: config.ollama.modelDisplayName
                        });
                    }
                }
            );
        } else {
            // Non-streaming response
            const result = await chatWithOllama(socketConversation);

            if (result.success) {
                socketConversation.push(result.message);
                socket.emit('chat_response', {
                    response: result.message.content,
                    model: config.ollama.modelDisplayName
                });
            } else {
                socket.emit('chat_error', { error: result.error });
            }
        }
    });

    // Clear conversation
    socket.on('clear_conversation', () => {
        socketConversation = [];
        socket.emit('conversation_cleared', { message: 'Conversation history cleared' });
    });

    // Get conversation history
    socket.on('get_history', () => {
        socket.emit('history', { messages: socketConversation });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// =============================================================================
// START SERVER
// =============================================================================

async function startServer() {
    console.log('');
    console.log('============================================================');
    console.log('   HARVEY - Local AI Gift Hub');
    console.log('   Helpful Assistant Ready to Virtually Excel You');
    console.log('============================================================');
    console.log('');

    // Check Ollama status
    const ollamaStatus = await checkOllamaStatus();

    if (!ollamaStatus.online) {
        console.log('[WARNING] Ollama is not running!');
        console.log('[INFO] Start Ollama with: ollama serve');
        console.log('');
    } else {
        console.log('[OK] Ollama is running');

        const modelAvailable = ollamaStatus.models?.some(m =>
            m.name.includes('gemma2:27b') || m.name.includes('gemma:27b')
        );

        if (!modelAvailable) {
            console.log(`[WARNING] Model ${config.ollama.model} not found!`);
            console.log('[INFO] Download with: ollama pull gemma2:27b');
        } else {
            console.log(`[OK] Model ${config.ollama.model} is available`);
        }
    }

    console.log('');

    server.listen(config.server.port, config.server.host, () => {
        const localIP = getLocalIP();

        console.log('[SERVER STARTED]');
        console.log('');
        console.log('Access Harvey at:');
        console.log(`  Local:   http://localhost:${config.server.port}`);
        console.log(`  Network: http://${localIP}:${config.server.port}`);
        console.log('');
        console.log('API Endpoints:');
        console.log(`  Chat:    POST http://localhost:${config.server.port}/api/chat`);
        console.log(`  Stream:  POST http://localhost:${config.server.port}/api/chat/stream`);
        console.log(`  Status:  GET  http://localhost:${config.server.port}/api/status`);
        console.log('');
        console.log('WebSocket:');
        console.log(`  URL:     ws://localhost:${config.server.port}`);
        console.log('');
        console.log('Authentication:');
        console.log(`  Header:  ${config.auth.headerName}: ${config.auth.password}`);
        console.log(`  Socket:  { password: "${config.auth.password}" }`);
        console.log('');
        console.log('============================================================');
        console.log('');
    });
}

function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

startServer();

module.exports = { app, server, io };
