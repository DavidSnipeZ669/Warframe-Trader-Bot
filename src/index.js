const cron = require('node-cron');
const config = require('./config');
const logger = require('./utils/logger');
const warframeMarket = require('./api/warframeMarket');
const inventoryService = require('./services/inventory');
const notificationService = require('./services/notification');
const priceAnalysisService = require('./services/priceAnalysis');
const marketAutomationService = require('./services/marketAutomation');

/**
 * Warframe Trader Bot
 * Market automation with inventory management and notifications
 */
class WarframeTraderBot {
  constructor() {
    this.cronJob = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the bot
   */
  async initialize() {
    try {
      logger.info('Initializing Warframe Trader Bot...');

      // Check configuration
      if (!config.warframeMarket.jwt) {
        logger.warn('Warframe Market JWT not configured - some features will be limited');
      }

      if (!config.discord.webhookUrl) {
        logger.warn('Discord webhook not configured - notifications disabled');
      }

      this.isInitialized = true;
      logger.info('Warframe Trader Bot initialized');

      return true;
    } catch (error) {
      logger.error('Failed to initialize bot:', error.message);
      return false;
    }
  }

  /**
   * Start the bot with scheduled tasks
   */
  async start() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize bot');
      }
    }

    logger.info('Starting Warframe Trader Bot...');

    // Start market automation
    await marketAutomationService.start();

    // Run initial cycle
    await this.runCycle();

    // Schedule periodic checks
    const interval = config.trading.priceCheckInterval;
    this.cronJob = cron.schedule(`*/${interval} * * * *`, async () => {
      await this.runCycle();
    });

    logger.info(`Bot started - checking prices every ${interval} minutes`);
    await notificationService.sendNotification(
      '🚀 Bot Started',
      `Warframe Trader Bot is now running. Checking prices every ${interval} minutes.`,
      'green'
    );
  }

  /**
   * Stop the bot
   */
  async stop() {
    logger.info('Stopping Warframe Trader Bot...');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    await marketAutomationService.stop();

    await notificationService.sendNotification(
      '🛑 Bot Stopped',
      'Warframe Trader Bot has been stopped.',
      'red'
    );

    logger.info('Bot stopped');
  }

  /**
   * Run a single automation cycle
   */
  async runCycle() {
    logger.info('Running bot cycle...');

    try {
      await marketAutomationService.runCycle();
    } catch (error) {
      logger.error('Error in bot cycle:', error.message);
      await notificationService.sendNotification(
        '⚠️ Error',
        `Error during bot cycle: ${error.message}`,
        'red'
      );
    }
  }

  /**
   * CLI Commands
   */
  async handleCommand(command, args) {
    switch (command) {
      case 'add':
        return this.addItem(args);
      case 'remove':
        return this.removeItem(args);
      case 'list':
        return this.listInventory();
      case 'analyze':
        return this.analyzeItem(args);
      case 'search':
        return this.searchItems(args);
      case 'scan':
        return this.scanMarket(args);
      case 'prices':
        return this.showPrices(args);
      case 'status':
        return this.showStatus();
      default:
        return this.showHelp();
    }
  }

  /**
   * Add an item to inventory
   */
  async addItem(args) {
    if (!args[0]) {
      console.log('Usage: add <item_url_name> [quantity] [min_sell_price] [max_buy_price]');
      return;
    }

    const urlName = args[0];
    const quantity = parseInt(args[1], 10) || 1;
    const minSellPrice = args[2] ? parseInt(args[2], 10) : null;
    const maxBuyPrice = args[3] ? parseInt(args[3], 10) : null;

    const item = inventoryService.addItem({
      urlName,
      quantity,
      minSellPrice,
      maxBuyPrice
    });

    console.log(`Added ${item.itemName} x${item.quantity} to inventory`);
    return item;
  }

  /**
   * Remove an item from inventory
   */
  async removeItem(args) {
    if (!args[0]) {
      console.log('Usage: remove <item_url_name>');
      return;
    }

    const removed = inventoryService.removeItem(args[0]);
    if (removed) {
      console.log(`Removed ${args[0]} from inventory`);
    } else {
      console.log(`Item ${args[0]} not found in inventory`);
    }
  }

  /**
   * List all inventory items
   */
  async listInventory() {
    const items = inventoryService.getAllItems();
    
    if (items.length === 0) {
      console.log('Inventory is empty');
      return items;
    }

    console.log('\n=== Inventory ===');
    items.forEach(item => {
      console.log(`- ${item.itemName} x${item.quantity}`);
      if (item.minSellPrice) console.log(`  Min sell: ${item.minSellPrice}p`);
      if (item.maxBuyPrice) console.log(`  Max buy: ${item.maxBuyPrice}p`);
    });
    console.log('');

    return items;
  }

  /**
   * Analyze an item's market
   */
  async analyzeItem(args) {
    if (!args[0]) {
      console.log('Usage: analyze <item_url_name>');
      return;
    }

    const urlName = args[0];
    console.log(`Analyzing ${urlName}...`);

    const analysis = await priceAnalysisService.analyzeItem(urlName);
    const history = await priceAnalysisService.getPriceHistory(urlName);

    console.log('\n=== Market Analysis ===');
    console.log(`Item: ${urlName.replace(/_/g, ' ')}`);
    console.log(`Lowest Sell: ${analysis.lowestSell}p (${analysis.sellOrderCount} orders)`);
    console.log(`Highest Buy: ${analysis.highestBuy}p (${analysis.buyOrderCount} orders)`);
    console.log(`Optimal Sell Price: ${analysis.optimalSellPrice}p`);
    console.log(`Optimal Buy Price: ${analysis.optimalBuyPrice}p`);
    
    if (analysis.profitMargin) {
      console.log(`Profit Margin: ${analysis.profitMargin}p (${analysis.profitPercentage}%)`);
    }

    if (history) {
      console.log('\n--- 48h Statistics ---');
      console.log(`Average: ${history.avgPrice}p`);
      console.log(`Min: ${history.minPrice}p`);
      console.log(`Max: ${history.maxPrice}p`);
      console.log(`Volume: ${history.volume}`);
      console.log(`Volatility: ${history.volatility}%`);
    }

    console.log('');
    return { analysis, history };
  }

  /**
   * Search for items
   */
  async searchItems(args) {
    if (!args[0]) {
      console.log('Usage: search <query>');
      return;
    }

    const query = args.join(' ').toLowerCase();
    console.log(`Searching for "${query}"...`);

    const allItems = await warframeMarket.getAllItems();
    const matches = allItems.filter(item => 
      item.item_name.toLowerCase().includes(query) ||
      item.url_name.toLowerCase().includes(query)
    ).slice(0, 20);

    if (matches.length === 0) {
      console.log('No items found');
      return [];
    }

    console.log('\n=== Search Results ===');
    matches.forEach(item => {
      console.log(`- ${item.item_name} (${item.url_name})`);
    });
    console.log('');

    return matches;
  }

  /**
   * Scan market for profitable trades
   */
  async scanMarket(args) {
    const limit = parseInt(args[0], 10) || 50;
    console.log(`Scanning market for profitable trades (limit: ${limit})...`);

    const opportunities = await priceAnalysisService.scanMarket(limit);

    if (opportunities.length === 0) {
      console.log('No profitable trades found');
      return [];
    }

    console.log(`\n=== Found ${opportunities.length} Profitable Trades ===`);
    opportunities.slice(0, 10).forEach(op => {
      console.log(`- ${op.urlName.replace(/_/g, ' ')}`);
      console.log(`  Buy: ${op.buyPrice}p | Sell: ${op.sellPrice}p | Profit: ${op.profitMargin}p (${op.profitPercentage}%)`);
    });
    console.log('');

    return opportunities;
  }

  /**
   * Show current prices for inventory items
   */
  async showPrices(args) {
    const items = inventoryService.getAllItems();
    
    if (items.length === 0) {
      console.log('No items in inventory');
      return [];
    }

    console.log('\n=== Current Prices ===');
    const prices = [];

    for (const item of items) {
      try {
        const analysis = await priceAnalysisService.getPrice(item.urlName);
        console.log(`- ${item.itemName}`);
        console.log(`  Sell: ${analysis.lowestSell}p | Buy: ${analysis.highestBuy}p`);
        prices.push({ ...item, ...analysis });
      } catch (error) {
        console.log(`- ${item.itemName}: Error fetching prices`);
      }
    }

    console.log('');
    return prices;
  }

  /**
   * Show bot status
   */
  async showStatus() {
    const items = inventoryService.getAllItems();
    
    console.log('\n=== Bot Status ===');
    console.log(`Initialized: ${this.isInitialized}`);
    console.log(`Running: ${this.cronJob !== null}`);
    console.log(`Inventory Items: ${items.length}`);
    console.log(`Auto-listing: ${config.trading.autoListingEnabled}`);
    console.log(`Check Interval: ${config.trading.priceCheckInterval} minutes`);
    console.log(`Min Profit: ${config.trading.minProfitPercentage}%`);
    console.log('');
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(`
Warframe Trader Bot Commands:

  add <item> [qty] [min_sell] [max_buy]  - Add item to inventory
  remove <item>                           - Remove item from inventory
  list                                    - List inventory items
  analyze <item>                          - Analyze item market
  search <query>                          - Search for items
  scan [limit]                            - Scan market for profitable trades
  prices                                  - Show current prices for inventory
  status                                  - Show bot status
  help                                    - Show this help

Examples:
  add volt_prime_set 1 150 100
  analyze rhino_prime_blueprint
  search volt
  scan 100
    `);
  }
}

// Export the bot class
module.exports = WarframeTraderBot;

// Run if executed directly
if (require.main === module) {
  const bot = new WarframeTraderBot();
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'start') {
    // Start the bot in continuous mode
    bot.start().catch(error => {
      logger.error('Failed to start bot:', error.message);
      process.exit(1);
    });

    // Handle shutdown
    process.on('SIGINT', async () => {
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await bot.stop();
      process.exit(0);
    });
  } else {
    // Run a single command
    bot.initialize().then(() => {
      return bot.handleCommand(command, args.slice(1));
    }).then(() => {
      process.exit(0);
    }).catch(error => {
      logger.error('Command failed:', error.message);
      process.exit(1);
    });
  }
}
