const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const warframeMarket = require('../api/warframeMarket');

/**
 * Get the appropriate data directory for the application
 */
function getDataDirectory() {
  return path.join(__dirname, '../../data');
}

const DATA_DIR = getDataDirectory();
const TRENDS_FILE = path.join(DATA_DIR, 'trends.json');

/**
 * Market Trends Service
 * Tracks price history and calculates trends for items
 */
class MarketTrendsService {
  constructor() {
    this.trends = {};
    this.ensureDataDirectory();
    this.loadTrends();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(TRENDS_FILE);
    
    try {
      if (fs.existsSync(dataDir)) {
        const stats = fs.statSync(dataDir);
        if (!stats.isDirectory()) {
          logger.warn(`Removing file at ${dataDir} to create directory`);
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
   * Load trends from file
   */
  loadTrends() {
    try {
      if (fs.existsSync(TRENDS_FILE)) {
        const data = fs.readFileSync(TRENDS_FILE, 'utf8');
        this.trends = JSON.parse(data);
        logger.info(`Loaded trends for ${Object.keys(this.trends).length} items`);
      } else {
        this.trends = {};
        this.saveTrends();
        logger.info('Created new trends file');
      }
    } catch (error) {
      logger.error('Error loading trends:', error.message);
      this.trends = {};
    }
  }

  /**
   * Save trends to file
   */
  saveTrends() {
    try {
      fs.writeFileSync(TRENDS_FILE, JSON.stringify(this.trends, null, 2));
    } catch (error) {
      logger.error('Error saving trends:', error.message);
    }
  }

  /**
   * Record a price point for an item
   * @param {string} urlName - Item URL name
   * @param {number} sellPrice - Current lowest sell price
   * @param {number} buyPrice - Current highest buy price
   */
  recordPrice(urlName, sellPrice, buyPrice) {
    if (!this.trends[urlName]) {
      this.trends[urlName] = {
        history: [],
        stats: {}
      };
    }

    const entry = {
      timestamp: new Date().toISOString(),
      sellPrice: sellPrice || null,
      buyPrice: buyPrice || null
    };

    this.trends[urlName].history.push(entry);

    // Keep only last 168 entries (7 days at hourly intervals)
    if (this.trends[urlName].history.length > 168) {
      this.trends[urlName].history = this.trends[urlName].history.slice(-168);
    }

    // Update stats
    this.updateStats(urlName);
    this.saveTrends();
  }

  /**
   * Update statistics for an item
   */
  updateStats(urlName) {
    const itemData = this.trends[urlName];
    if (!itemData || itemData.history.length === 0) return;

    const history = itemData.history;
    const sellPrices = history.map(h => h.sellPrice).filter(p => p !== null);
    const buyPrices = history.map(h => h.buyPrice).filter(p => p !== null);

    // Calculate averages
    const avgSell = sellPrices.length > 0 
      ? Math.round(sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length)
      : null;
    const avgBuy = buyPrices.length > 0 
      ? Math.round(buyPrices.reduce((a, b) => a + b, 0) / buyPrices.length)
      : null;

    // Calculate min/max
    const minSell = sellPrices.length > 0 ? Math.min(...sellPrices) : null;
    const maxSell = sellPrices.length > 0 ? Math.max(...sellPrices) : null;
    const minBuy = buyPrices.length > 0 ? Math.min(...buyPrices) : null;
    const maxBuy = buyPrices.length > 0 ? Math.max(...buyPrices) : null;

    // Calculate trend (comparing last 24h to previous 24h)
    const now = new Date();
    const last24h = history.filter(h => 
      (now - new Date(h.timestamp)) <= 24 * 60 * 60 * 1000
    );
    const prev24h = history.filter(h => {
      const diff = now - new Date(h.timestamp);
      return diff > 24 * 60 * 60 * 1000 && diff <= 48 * 60 * 60 * 1000;
    });

    let sellTrend = 'stable';
    let buyTrend = 'stable';

    if (last24h.length > 0 && prev24h.length > 0) {
      const lastSellPrices = last24h.map(h => h.sellPrice).filter(p => p !== null);
      const prevSellPrices = prev24h.map(h => h.sellPrice).filter(p => p !== null);
      const lastBuyPrices = last24h.map(h => h.buyPrice).filter(p => p !== null);
      const prevBuyPrices = prev24h.map(h => h.buyPrice).filter(p => p !== null);

      if (lastSellPrices.length > 0 && prevSellPrices.length > 0) {
        const lastAvgSell = lastSellPrices.reduce((a, b) => a + b, 0) / lastSellPrices.length;
        const prevAvgSell = prevSellPrices.reduce((a, b) => a + b, 0) / prevSellPrices.length;
        const sellChange = ((lastAvgSell - prevAvgSell) / prevAvgSell) * 100;
        
        if (sellChange > 5) sellTrend = 'up';
        else if (sellChange < -5) sellTrend = 'down';
      }

      if (lastBuyPrices.length > 0 && prevBuyPrices.length > 0) {
        const lastAvgBuy = lastBuyPrices.reduce((a, b) => a + b, 0) / lastBuyPrices.length;
        const prevAvgBuy = prevBuyPrices.reduce((a, b) => a + b, 0) / prevBuyPrices.length;
        const buyChange = ((lastAvgBuy - prevAvgBuy) / prevAvgBuy) * 100;
        
        if (buyChange > 5) buyTrend = 'up';
        else if (buyChange < -5) buyTrend = 'down';
      }
    }

    // Get current price (latest entry)
    const latest = history[history.length - 1];

    itemData.stats = {
      currentSell: latest.sellPrice,
      currentBuy: latest.buyPrice,
      avgSell,
      avgBuy,
      minSell,
      maxSell,
      minBuy,
      maxBuy,
      sellTrend,
      buyTrend,
      dataPoints: history.length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get trend data for an item
   * @param {string} urlName - Item URL name
   * @returns {Object|null} Trend data
   */
  getTrend(urlName) {
    return this.trends[urlName] || null;
  }

  /**
   * Get trend stats for an item
   * @param {string} urlName - Item URL name
   * @returns {Object|null} Stats
   */
  getStats(urlName) {
    const trend = this.trends[urlName];
    return trend ? trend.stats : null;
  }

  /**
   * Get price history for an item
   * @param {string} urlName - Item URL name
   * @param {number} limit - Max entries to return
   * @returns {Array} Price history
   */
  getHistory(urlName, limit = 24) {
    const trend = this.trends[urlName];
    if (!trend) return [];
    return trend.history.slice(-limit);
  }

  /**
   * Fetch and record current prices for an item
   * @param {string} urlName - Item URL name
   * @returns {Object} Current prices and trend
   */
  async fetchAndRecordPrices(urlName) {
    try {
      const orders = await warframeMarket.getItemOrders(urlName);
      if (!orders) return null;

      // Get online sell orders
      const sellOrders = orders
        .filter(o => o.order_type === 'sell' && o.user && o.user.status === 'ingame')
        .sort((a, b) => a.platinum - b.platinum);
      
      // Get online buy orders
      const buyOrders = orders
        .filter(o => o.order_type === 'buy' && o.user && o.user.status === 'ingame')
        .sort((a, b) => b.platinum - a.platinum);

      const lowestSell = sellOrders.length > 0 ? sellOrders[0].platinum : null;
      const highestBuy = buyOrders.length > 0 ? buyOrders[0].platinum : null;

      // Record the price point
      this.recordPrice(urlName, lowestSell, highestBuy);

      return {
        currentSell: lowestSell,
        currentBuy: highestBuy,
        stats: this.getStats(urlName),
        history: this.getHistory(urlName, 24)
      };
    } catch (error) {
      logger.error(`Error fetching trend data for ${urlName}:`, error.message);
      return null;
    }
  }

  /**
   * Get all tracked items with their trends
   * @returns {Array} Items with trend data
   */
  getAllTrends() {
    return Object.entries(this.trends).map(([urlName, data]) => ({
      urlName,
      ...data.stats
    }));
  }

  /**
   * Clear trend data for an item
   * @param {string} urlName - Item URL name
   */
  clearItem(urlName) {
    if (this.trends[urlName]) {
      delete this.trends[urlName];
      this.saveTrends();
      logger.info(`Cleared trend data for ${urlName}`);
    }
  }

  /**
   * Clear all trend data
   */
  clearAll() {
    this.trends = {};
    this.saveTrends();
    logger.info('Cleared all trend data');
  }
}

module.exports = new MarketTrendsService();
