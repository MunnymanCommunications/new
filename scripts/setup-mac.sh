#!/bin/bash

echo "============================================================"
echo "   HARVEY - Local AI Gift Hub Setup (macOS)"
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

echo -e "${BLUE}[1/6] Checking system requirements...${NC}"
echo ""

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}[INFO] Homebrew not found. Installing...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add brew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo -e "${GREEN}[OK] Homebrew is installed${NC}"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[INFO] Node.js not found. Installing via Homebrew...${NC}"
    brew install node
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

    # Download and install Ollama
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
ollama serve &> /dev/null &
sleep 5
echo -e "${GREEN}[OK] Ollama service started${NC}"

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
    ollama serve &> /dev/null &
    sleep 3
fi

# Start Harvey server
node server/index.js
EOF

chmod +x "$PROJECT_DIR/start-harvey.sh"
echo -e "${GREEN}[OK] Created start-harvey.sh for future use${NC}"

# Open browser and start server
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}   Harvey is starting!${NC}"
echo -e "${GREEN}   Open http://localhost:3847 in your browser${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

# Open browser after a delay
(sleep 3 && open "http://localhost:3847") &

# Start the server
node server/index.js
