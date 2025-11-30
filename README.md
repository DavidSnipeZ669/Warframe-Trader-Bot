# Warframe-Trader-Bot

A market automation bot for [Warframe Market](https://warframe.market) with inventory management, price optimization, and notification features. Inspired by ["The Unreasonable Efficiency of Algorithmic Trading (Warframe)"](https://www.youtube.com/watch?v=your_video_id) by Yelbuzz.

**Note:** This bot automates market listings only - there is NO in-game automation.

## Features

- 🖥️ **Desktop Application** - Full Electron GUI for easy management
- 📊 **Market Automation** - Automatically manage market listings with optimal pricing
- 📦 **Inventory Management** - Track your tradeable items with quantity controls
- 🔔 **Notifications** - Get alerts via Discord webhook or SMS for profitable trades
- 💰 **Price Optimization** - Automatic undercutting/overcutting for best market position
- 📈 **Profit Analysis** - Identify profitable flip opportunities
- ⏰ **Scheduled Updates** - Periodic price checks and order updates
- ✅ **Enable/Disable Items** - Toggle auto-listing for individual items
- 🔢 **Multiple Quantities** - List multiple of the same item (e.g., 4x Limbo Prime Blueprint)

## Installation

```bash
# Clone the repository
git clone https://github.com/DavidSnipeZ669/Warframe-Trader-Bot.git
cd Warframe-Trader-Bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Usage

### Desktop Application (Recommended)

Launch the Electron app with a full graphical interface:

```bash
npm start
```

The GUI allows you to:
- **Search and add items** to your inventory
- **Adjust quantities** using +/- controls or direct input
- **Enable/disable items** from auto-listing with toggle switches
- **Set price constraints** (min sell, max buy) for each item
- **Analyze market prices** with one click
- **Start/Stop the bot** from the header

### CLI Mode

If you prefer command-line usage:

```bash
# Start bot in CLI mode
npm run start:cli

# Other CLI commands
npm run add -- volt_prime_set 4 150 100  # Add 4x Volt Prime Set
npm run list                              # List inventory
npm run analyze -- rhino_prime_blueprint  # Analyze item
npm run search -- limbo prime             # Search items
npm run scan -- 100                       # Scan for profitable trades
npm run prices                            # Show current prices
npm run status                            # Show bot status
npm run help                              # Show help
```

## Getting Your Warframe Market JWT Token

The bot requires a JWT token to interact with your Warframe Market account. There are two ways to get it:

### Method 1: Browser Cookie (Recommended)

1. Go to [warframe.market](https://warframe.market) and log in to your account
2. Open your browser's Developer Tools (`Ctrl + Shift + I` or `F12`)
3. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Expand **Cookies** → Click on `https://warframe.market`
5. Find the cookie named `JWT`
6. Copy the token value (the long string)
7. Paste it in your `.env` file as `WARFRAME_MARKET_JWT=your_token_here`

### Method 2: API Authentication

You can also authenticate programmatically:

```bash
curl -X POST https://api.warframe.market/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "your_email", "password": "your_password"}'
```

The response will contain your JWT token.

> ⚠️ **Security Warning:** Treat your JWT token like a password. Never share it or commit it to version control!

## Configuration

Edit the `.env` file with your settings:

```env
# Warframe Market API v2
WARFRAME_MARKET_JWT=your_jwt_token_here
WARFRAME_PLATFORM=pc                    # pc, ps4, xbox, switch, mobile
WARFRAME_CROSSPLAY=true                 # Include cross-play orders

# Discord Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# SMS Notifications (Optional - via Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
YOUR_PHONE_NUMBER=+1234567890

# Trading Settings
MIN_PROFIT_PERCENTAGE=5                 # Minimum profit % to notify
MAX_PLATINUM_FOR_ORDERS=500             # Max platinum for buy orders
PRICE_CHECK_INTERVAL=5                  # Minutes between price checks
AUTO_LISTING_ENABLED=true               # Enable auto-listing
SELL_UNDERCUT_AMOUNT=1                  # Undercut sell orders by X platinum
BUY_OVERCUT_AMOUNT=1                    # Overcut buy orders by X platinum
```

## API (Warframe Market v2)

This bot uses the [Warframe Market API v2](https://42bytes.notion.site/WFM-Api-v2-Documentation-5d987e4aa2f74b55a80db1a09932459d).

### Rate Limits

- **3 requests per second** - The bot automatically handles rate limiting
- Exceeding limits returns `429` error
- Too many concurrent connections returns `509` error

### Supported Platforms

- `pc` (default)
- `ps4`
- `xbox`
- `switch`
- `mobile`

### Crossplay

When enabled, the bot includes cross-play orders from other platforms in price calculations.

## Project Structure

```
warframe-trader-bot/
├── app/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Secure IPC bridge
│   ├── index.html        # GUI layout
│   ├── styles.css        # GUI styling
│   └── renderer.js       # GUI logic
├── src/
│   ├── api/
│   │   └── warframeMarket.js    # Warframe Market API v2 client
│   ├── services/
│   │   ├── inventory.js         # Inventory management
│   │   ├── marketAutomation.js  # Market automation service
│   │   ├── notification.js      # Discord/SMS notifications
│   │   └── priceAnalysis.js     # Price analysis & profit detection
│   ├── utils/
│   │   └── logger.js            # Logging utility
│   ├── config.js                # Configuration
│   └── index.js                 # CLI application
├── tests/                       # Test files
├── data/                        # Inventory data (auto-created)
├── logs/                        # Log files (auto-created)
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## Building the App

To create distributable packages:

```bash
# Install electron-builder
npm install electron-builder --save-dev

# Build for your platform
npm run build

# Or build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Discord Webhook Setup

1. Open Discord and go to your server
2. Right-click on the channel → **Edit Channel**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Copy the **Webhook URL**
6. Paste it in your `.env` file

## How It Works

### Price Optimization

The bot calculates optimal prices by:
1. Fetching all current orders for an item
2. Finding the lowest sell price and highest buy price from online users
3. Setting your sell price = lowest sell - undercut amount
4. Setting your buy price = highest buy + overcut amount

### Profit Detection

The bot identifies profitable "flip" opportunities where:
- Profit % = (Sell Price - Buy Price) / Buy Price × 100
- Trades with profit % above your threshold trigger notifications

### Notifications

When profitable trades are found, you receive:
- **Discord**: Rich embed with item details, prices, and profit margin
- **SMS** (optional): Text message with trade summary

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This bot is for educational purposes. Use at your own risk. The developers are not responsible for any losses incurred while trading. Always verify prices manually before making significant trades.

## License

MIT
