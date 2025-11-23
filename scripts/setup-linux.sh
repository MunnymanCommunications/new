#!/bin/bash

echo "============================================================"
echo "   HARVEY - Local AI Gift Hub Setup (Linux)"
echo "   Helpful Assistant Ready to Virtually Excel You"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Detect package manager
detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        echo "apt"
    elif command -v dnf &> /dev/null; then
        echo "dnf"
    elif command -v yum &> /dev/null; then
        echo "yum"
    elif command -v pacman &> /dev/null; then
        echo "pacman"
    elif command -v zypper &> /dev/null; then
        echo "zypper"
    else
        echo "unknown"
    fi
}

PKG_MANAGER=$(detect_package_manager)
echo -e "${BLUE}[INFO] Detected package manager: $PKG_MANAGER${NC}"
echo ""

echo -e "${BLUE}[1/6] Checking system requirements...${NC}"
echo ""

# Install curl if not present
if ! command -v curl &> /dev/null; then
    echo -e "${YELLOW}[INFO] Installing curl...${NC}"
    case $PKG_MANAGER in
        apt) sudo apt-get update && sudo apt-get install -y curl ;;
        dnf) sudo dnf install -y curl ;;
        yum) sudo yum install -y curl ;;
        pacman) sudo pacman -S --noconfirm curl ;;
        zypper) sudo zypper install -y curl ;;
    esac
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[INFO] Node.js not found. Installing...${NC}"

    case $PKG_MANAGER in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        dnf)
            sudo dnf install -y nodejs npm
            ;;
        yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
            ;;
        pacman)
            sudo pacman -S --noconfirm nodejs npm
            ;;
        zypper)
            sudo zypper install -y nodejs npm
            ;;
        *)
            echo -e "${RED}[ERROR] Could not install Node.js automatically${NC}"
            echo -e "${YELLOW}[INFO] Please install Node.js manually from: https://nodejs.org/${NC}"
            exit 1
            ;;
    esac
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}[OK] Node.js found: $NODE_VERSION${NC}"
fi

echo ""
echo -e "${BLUE}[2/6] Checking for Ollama...${NC}"
echo ""

# Check for Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}[INFO] Ollama not found. Installing...${NC}"

    curl -fsSL https://ollama.com/install.sh | sh

    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to install Ollama${NC}"
        echo -e "${YELLOW}[INFO] Please install manually from: https://ollama.com/download${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[OK] Ollama is already installed${NC}"
fi

echo ""
echo -e "${BLUE}[3/6] Starting Ollama service...${NC}"
echo ""

# Start Ollama in the background
# Try systemd first, then fall back to direct start
if systemctl is-active --quiet ollama 2>/dev/null; then
    echo -e "${GREEN}[OK] Ollama service is already running${NC}"
elif command -v systemctl &> /dev/null && systemctl list-unit-files ollama.service &> /dev/null; then
    sudo systemctl start ollama
    sudo systemctl enable ollama
    echo -e "${GREEN}[OK] Ollama service started via systemd${NC}"
else
    ollama serve &> /dev/null &
    sleep 5
    echo -e "${GREEN}[OK] Ollama service started${NC}"
fi

echo ""
echo -e "${BLUE}[4/6] Downloading Gemma 27B model (this may take a while ~16GB)...${NC}"
echo ""

# Pull the Gemma 27B model
ollama pull gemma2:27b
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[WARNING] Failed to pull gemma2:27b, trying alternative...${NC}"
    ollama pull gemma:27b
fi

echo ""
echo -e "${BLUE}[5/6] Installing Node.js dependencies...${NC}"
echo ""

# Install npm dependencies
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to install dependencies${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[6/6] Starting Harvey server...${NC}"
echo ""

# Create startup script
cat > "$PROJECT_DIR/start-harvey.sh" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Start Ollama if not running
if ! pgrep -x "ollama" > /dev/null; then
    if command -v systemctl &> /dev/null && systemctl list-unit-files ollama.service &> /dev/null; then
        sudo systemctl start ollama
    else
        ollama serve &> /dev/null &
    fi
    sleep 3
fi

# Start Harvey server
node server/index.js
EOF

chmod +x "$PROJECT_DIR/start-harvey.sh"
echo -e "${GREEN}[OK] Created start-harvey.sh for future use${NC}"

# Create systemd service file for auto-start (optional)
cat > "$PROJECT_DIR/harvey.service" << EOF
[Unit]
Description=Harvey Local AI Assistant
After=network.target ollama.service

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node $PROJECT_DIR/server/index.js
Restart=on-failure
User=$USER

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}[OK] Created harvey.service for systemd (optional)${NC}"
echo -e "${YELLOW}[INFO] To enable auto-start: sudo cp harvey.service /etc/systemd/system/ && sudo systemctl enable harvey${NC}"

# Open browser and start server
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   Harvey is starting!${NC}"
echo -e "${GREEN}   Open http://localhost:3847 in your browser${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

# Try to open browser
if command -v xdg-open &> /dev/null; then
    (sleep 3 && xdg-open "http://localhost:3847") &
elif command -v gnome-open &> /dev/null; then
    (sleep 3 && gnome-open "http://localhost:3847") &
fi

# Start the server
node server/index.js
