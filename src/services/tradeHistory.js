const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Get the appropriate data directory for the application
 */
function getDataDirectory() {
  const localDataDir = path.join(__dirname, '../../data');
  return localDataDir;
}

const DATA_DIR = getDataDirectory();
const HISTORY_FILE = path.join(DATA_DIR, 'trade_history.json');

/**
 * Trade History Service
 * Tracks all buy/sell transactions
 */
class TradeHistoryService {
  constructor() {
    this.history = [];
    this.ensureDataDirectory();
    this.loadHistory();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(HISTORY_FILE);
    
    try {
      if (fs.existsSync(dataDir)) {
        const stats = fs.statSync(dataDir);
        if (!stats.isDirectory()) {
          fs.unlinkSync(dataDir);
          fs.mkdirSync(dataDir, { recursive: true });
        }
      } else {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (error) {
      logger.error('Error ensuring data directory:', error.message);
    }
  }

  /**
   * Load history from file
   */
  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        this.history = JSON.parse(data);
        logger.info(`Loaded ${this.history.length} trade history entries`);
      } else {
        this.history = [];
        this.saveHistory();
        logger.info('Created new trade history file');
      }
    } catch (error) {
      logger.error('Error loading trade history:', error.message);
      this.history = [];
    }
  }

  /**
   * Save history to file
   */
  saveHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
      logger.info('Trade history saved');
    } catch (error) {
      logger.error('Error saving trade history:', error.message);
    }
  }

  /**
   * Add a trade to history
   * @param {Object} trade - Trade data
   * @param {string} trade.type - 'buy' or 'sell'
   * @param {string} trade.itemName - Name of the item
   * @param {string} trade.urlName - URL name of the item
   * @param {number} trade.quantity - Quantity traded
   * @param {number} trade.price - Price per unit
   * @param {string} trade.buyer - Buyer's username (optional)
   * @param {string} trade.seller - Seller's username (optional)
   * @returns {Object} The created trade entry
   */
  addTrade(trade) {
    const tradeEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      type: trade.type, // 'buy' or 'sell'
      itemName: trade.itemName,
      urlName: trade.urlName,
      quantity: trade.quantity || 1,
      price: trade.price,
      totalValue: (trade.quantity || 1) * trade.price,
      buyer: trade.buyer || null,
      seller: trade.seller || null,
      timestamp: new Date().toISOString()
    };

    this.history.unshift(tradeEntry); // Add to beginning for chronological order
    
    // Keep only last 500 trades to prevent file from growing too large
    if (this.history.length > 500) {
      this.history = this.history.slice(0, 500);
    }
    
    this.saveHistory();
    logger.info(`Added trade: ${trade.type} ${trade.quantity}x ${trade.itemName} @ ${trade.price}p`);
    return tradeEntry;
  }

  /**
   * Record a sale
   * @param {string} itemName - Item name
   * @param {string} urlName - URL name
   * @param {number} quantity - Quantity sold
   * @param {number} price - Price per unit
   * @param {string} buyer - Buyer's username
   */
  recordSale(itemName, urlName, quantity, price, buyer = null) {
    return this.addTrade({
      type: 'sell',
      itemName,
      urlName,
      quantity,
      price,
      buyer
    });
  }

  /**
   * Record a purchase
   * @param {string} itemName - Item name
   * @param {string} urlName - URL name
   * @param {number} quantity - Quantity bought
   * @param {number} price - Price per unit
   * @param {string} seller - Seller's username
   */
  recordPurchase(itemName, urlName, quantity, price, seller = null) {
    return this.addTrade({
      type: 'buy',
      itemName,
      urlName,
      quantity,
      price,
      seller
    });
  }

  /**
   * Get all history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Trade history entries
   */
  getHistory(limit = 100) {
    return this.history.slice(0, limit);
  }

  /**
   * Get history for a specific item
   * @param {string} urlName - URL name of the item
   * @returns {Array} Trade history entries for the item
   */
  getItemHistory(urlName) {
    return this.history.filter(trade => trade.urlName === urlName);
  }

  /**
   * Get sales only
   * @param {number} limit - Maximum number of entries
   * @returns {Array} Sales history
   */
  getSales(limit = 100) {
    return this.history.filter(trade => trade.type === 'sell').slice(0, limit);
  }

  /**
   * Get purchases only
   * @param {number} limit - Maximum number of entries
   * @returns {Array} Purchase history
   */
  getPurchases(limit = 100) {
    return this.history.filter(trade => trade.type === 'buy').slice(0, limit);
  }

  /**
   * Get today's trades
   * @returns {Array} Today's trade history
   */
  getTodayTrades() {
    const today = new Date().toDateString();
    return this.history.filter(trade => {
      const tradeDate = new Date(trade.timestamp).toDateString();
      return tradeDate === today;
    });
  }

  /**
   * Get today's statistics
   * @returns {Object} Statistics for today
   */
  getTodayStats() {
    const todayTrades = this.getTodayTrades();
    const sales = todayTrades.filter(t => t.type === 'sell');
    const purchases = todayTrades.filter(t => t.type === 'buy');
    
    return {
      totalTrades: todayTrades.length,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      totalSalesValue: sales.reduce((sum, t) => sum + t.totalValue, 0),
      totalPurchasesValue: purchases.reduce((sum, t) => sum + t.totalValue, 0),
      profit: sales.reduce((sum, t) => sum + t.totalValue, 0) - purchases.reduce((sum, t) => sum + t.totalValue, 0)
    };
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
    logger.info('Trade history cleared');
  }

  /**
   * Delete a specific trade entry
   * @param {string} tradeId - The trade ID to delete
   * @returns {boolean} True if deleted
   */
  deleteTrade(tradeId) {
    const index = this.history.findIndex(t => t.id === tradeId);
    if (index >= 0) {
      this.history.splice(index, 1);
      this.saveHistory();
      return true;
    }
    return false;
  }
}

module.exports = new TradeHistoryService();
