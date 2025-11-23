/**
 * Harvey Chat Client
 * WebSocket-based chat interface
 */

// Configuration
const CONFIG = {
    password: localStorage.getItem('harvey_password') || '',
    serverUrl: window.location.origin,
    socketUrl: window.location.origin
};

// State
let socket = null;
let isAuthenticated = false;
let isTyping = false;
let currentResponse = '';

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const loginModal = document.getElementById('loginModal');
const passwordInput = document.getElementById('passwordInput');
const charCount = document.getElementById('charCount');
const connectionStatus = document.getElementById('connectionStatus');
const modelBadge = document.getElementById('modelBadge');

// Status indicators
const serverStatus = document.getElementById('serverStatus');
const ollamaStatus = document.getElementById('ollamaStatus');
const modelStatus = document.getElementById('modelStatus');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved password
    if (CONFIG.password) {
        connectSocket();
    } else {
        showLoginModal();
    }

    // Setup event listeners
    setupEventListeners();

    // Check server status
    checkStatus();
    setInterval(checkStatus, 30000); // Check every 30 seconds
});

function setupEventListeners() {
    // Message input
    messageInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateCharCount();
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Password input
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            authenticate();
        }
    });
}

function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

function updateCharCount() {
    charCount.textContent = `${messageInput.value.length} characters`;
}

// Authentication
function showLoginModal() {
    loginModal.classList.add('show');
    passwordInput.focus();
}

function hideLoginModal() {
    loginModal.classList.remove('show');
}

function authenticate() {
    const password = passwordInput.value.trim();
    if (password) {
        CONFIG.password = password;
        localStorage.setItem('harvey_password', password);
        connectSocket();
        hideLoginModal();
    }
}

// WebSocket Connection
function connectSocket() {
    updateConnectionStatus('connecting');

    socket = io(CONFIG.socketUrl, {
        auth: {
            password: CONFIG.password
        },
        query: {
            password: CONFIG.password
        }
    });

    socket.on('connect', () => {
        console.log('Connected to Harvey');
        isAuthenticated = true;
        updateConnectionStatus('connected');
    });

    socket.on('connected', (data) => {
        console.log('Harvey says:', data.message);
        if (data.model) {
            modelBadge.textContent = data.model;
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
        if (error.message.includes('Authentication')) {
            localStorage.removeItem('harvey_password');
            CONFIG.password = '';
            showLoginModal();
        }
        updateConnectionStatus('error');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Harvey');
        updateConnectionStatus('disconnected');
    });

    // Chat events
    socket.on('chat_response', (data) => {
        removeTypingIndicator();
        addMessage('assistant', data.response);
        enableInput();
    });

    socket.on('chat_start', () => {
        currentResponse = '';
    });

    socket.on('chat_chunk', (data) => {
        if (!isTyping) {
            removeTypingIndicator();
            addStreamingMessage();
            isTyping = true;
        }
        currentResponse += data.chunk;
        updateStreamingMessage(currentResponse);
    });

    socket.on('chat_complete', (data) => {
        finalizeStreamingMessage(data.response);
        isTyping = false;
        currentResponse = '';
        enableInput();
    });

    socket.on('chat_error', (data) => {
        removeTypingIndicator();
        addMessage('error', `Error: ${data.error}`);
        enableInput();
    });

    socket.on('conversation_cleared', () => {
        clearChatUI();
    });
}

function updateConnectionStatus(status) {
    const statusDot = connectionStatus.querySelector('.status-dot');
    const statusText = connectionStatus;

    statusDot.className = 'status-dot';

    switch (status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.innerHTML = '<span class="status-dot connected"></span> Connected via WebSocket';
            break;
        case 'connecting':
            statusText.innerHTML = '<span class="status-dot warning"></span> Connecting...';
            break;
        case 'disconnected':
            statusDot.classList.add('offline');
            statusText.innerHTML = '<span class="status-dot offline"></span> Disconnected';
            break;
        case 'error':
            statusDot.classList.add('offline');
            statusText.innerHTML = '<span class="status-dot offline"></span> Connection Error';
            break;
    }
}

// Chat Functions
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !socket || !isAuthenticated) return;

    // Add user message to chat
    addMessage('user', message);

    // Clear input
    messageInput.value = '';
    autoResizeTextarea();
    updateCharCount();

    // Disable input while waiting
    disableInput();

    // Show typing indicator
    showTypingIndicator();

    // Send to server (with streaming)
    socket.emit('chat', {
        message: message,
        stream: true
    });
}

function addMessage(role, content) {
    // Remove welcome message if present
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessage(content);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addStreamingMessage() {
    // Remove welcome message if present
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    messageDiv.id = 'streamingMessage';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.id = 'streamingContent';

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function updateStreamingMessage(content) {
    const contentDiv = document.getElementById('streamingContent');
    if (contentDiv) {
        contentDiv.innerHTML = formatMessage(content);
        scrollToBottom();
    }
}

function finalizeStreamingMessage(content) {
    const messageDiv = document.getElementById('streamingMessage');
    const contentDiv = document.getElementById('streamingContent');

    if (messageDiv && contentDiv) {
        messageDiv.classList.remove('streaming');
        messageDiv.removeAttribute('id');
        contentDiv.innerHTML = formatMessage(content);
        contentDiv.removeAttribute('id');
    }
}

function formatMessage(content) {
    // Basic markdown-like formatting
    let formatted = content
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Code blocks
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Line breaks
        .replace(/\n/g, '<br>');

    return formatted;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';

    indicator.appendChild(avatar);
    indicator.appendChild(typing);

    chatMessages.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function disableInput() {
    messageInput.disabled = true;
    sendButton.disabled = true;
}

function enableInput() {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
}

function clearConversation() {
    if (socket && isAuthenticated) {
        socket.emit('clear_conversation');
    }
    clearChatUI();
}

function clearChatUI() {
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🤖</div>
            <h3>Welcome to Harvey!</h3>
            <p><strong>H</strong>elpful <strong>A</strong>ssistant <strong>R</strong>eady to <strong>V</strong>irtually <strong>E</strong>xcel <strong>Y</strong>ou</p>
            <p class="welcome-desc">I'm your local AI assistant powered by Gemma 27B. I run entirely on your machine - your conversations stay private.</p>
            <div class="welcome-tips">
                <p>💡 Try asking me:</p>
                <ul>
                    <li>"Explain how neural networks work"</li>
                    <li>"Help me write a Python function"</li>
                    <li>"What are the best practices for REST API design?"</li>
                </ul>
            </div>
        </div>
    `;
}

// Status Check
async function checkStatus() {
    try {
        const response = await fetch(`${CONFIG.serverUrl}/api/status`);
        const data = await response.json();

        // Update status indicators
        serverStatus.className = 'status-dot ' + (data.harvey?.status === 'online' ? 'online' : 'offline');
        ollamaStatus.className = 'status-dot ' + (data.ollama?.status === 'online' ? 'online' : 'offline');
        modelStatus.className = 'status-dot ' + (data.model?.available ? 'online' : 'warning');

        // Update model badge
        if (data.model?.displayName) {
            modelBadge.textContent = data.model.displayName;
        }

    } catch (error) {
        console.error('Status check failed:', error);
        serverStatus.className = 'status-dot offline';
        ollamaStatus.className = 'status-dot offline';
        modelStatus.className = 'status-dot offline';
    }
}
