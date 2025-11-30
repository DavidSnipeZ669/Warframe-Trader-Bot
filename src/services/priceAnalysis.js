const warframeMarket = require('../api/warframeMarket');
const inventoryService = require('./inventory');
const notificationService = require('./notification');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Price Analysis Service
 * Analyzes market prices and identifies profitable trades
 */
class PriceAnalysisService {
  constructor() {
    this.priceCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Analyze price for a single item
   * @param {string} urlName - The URL name of the item
   * @returns {Promise<Object>} Price analysis
   */
  async analyzeItem(urlName) {
    try {
      const priceData = await warframeMarket.calculateBestPrices(urlName);
      
      // Cache the result
      this.priceCache.set(urlName, {
        data: priceData,
        timestamp: Date.now()
      });

      return priceData;
    } catch (error) {
      logger.error(`Error analyzing item ${urlName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get cached price or fetch new
   * @param {string} urlName - The URL name of the item
   * @returns {Promise<Object>} Price data
   */
  async getPrice(urlName) {
    const cached = this.priceCache.get(urlName);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return this.analyzeItem(urlName);
  }

  /**
   * Find profitable trades in the market
   * @param {Array} items - Array of item URL names to check
   * @returns {Promise<Array>} Profitable trade opportunities
   */
  async findProfitableTrades(items) {
    const opportunities = [];
    const minProfit = config.trading.minProfitPercentage;

    for (const urlName of items) {
      try {
        const analysis = await this.analyzeItem(urlName);
        
        if (analysis.profitPercentage >= minProfit && analysis.profitMargin > 0) {
          opportunities.push({
            urlName,
            itemName: analysis.itemName,
            buyPrice: analysis.highestBuy,
            sellPrice: analysis.lowestSell,
            profitMargin: analysis.profitMargin,
            profitPercentage: analysis.profitPercentage,
            tradeType: 'Flip'
          });

          logger.info(`Found profitable trade: ${urlName} - ${analysis.profitPercentage}% profit`);
        }

        // Add a small delay to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        logger.error(`Error analyzing ${urlName}:`, error.message);
      }
    }

    // Sort by profit percentage
    opportunities.sort((a, b) => parseFloat(b.profitPercentage) - parseFloat(a.profitPercentage));

    return opportunities;
  }

  /**
   * Analyze inventory items for profit opportunities
   * @returns {Promise<Array>} Opportunities from inventory
   */
  async analyzeInventory() {
    const inventoryItems = inventoryService.getAllItems();
    const opportunities = [];

    for (const item of inventoryItems) {
      try {
        const analysis = await this.analyzeItem(item.urlName);
        
        // Check if selling now would be profitable
        if (item.minSellPrice && analysis.lowestSell > item.minSellPrice) {
          opportunities.push({
            ...item,
            currentLowestSell: analysis.lowestSell,
            recommendedSellPrice: analysis.optimalSellPrice,
            action: 'SELL'
          });
        }

        // Check if buying would be profitable
        if (item.maxBuyPrice && analysis.highestBuy < item.maxBuyPrice) {
          opportunities.push({
            ...item,
            currentHighestBuy: analysis.highestBuy,
            recommendedBuyPrice: analysis.optimalBuyPrice,
            action: 'BUY'
          });
        }

        await this.delay(100);
      } catch (error) {
        logger.error(`Error analyzing inventory item ${item.urlName}:`, error.message);
      }
    }

    return opportunities;
  }

  /**
   * Scan market for high-volume profitable items
   * @param {number} limit - Maximum items to scan
   * @returns {Promise<Array>} Top profitable items
   */
  async scanMarket(limit = 100) {
    try {
      const allItems = await warframeMarket.getAllItems();
      
      // Take a random sample for scanning
      const shuffled = allItems.sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, limit);

      const urlNames = sample.map(item => item.url_name);
      return await this.findProfitableTrades(urlNames);
    } catch (error) {
      logger.error('Error scanning market:', error.message);
      throw error;
    }
  }

  /**
   * Get price history analysis
   * @param {string} urlName - The URL name of the item
   * @returns {Promise<Object>} Price history analysis
   */
  async getPriceHistory(urlName) {
    try {
      const stats = await warframeMarket.getItemStatistics(urlName);
      
      if (!stats || !stats['48hours'] || stats['48hours'].length === 0) {
        return null;
      }

      const recentStats = stats['48hours'];
      const avgPrice = recentStats.reduce((sum, s) => sum + s.avg_price, 0) / recentStats.length;
      const minPrice = Math.min(...recentStats.map(s => s.min_price));
      const maxPrice = Math.max(...recentStats.map(s => s.max_price));
      const volume = recentStats.reduce((sum, s) => sum + s.volume, 0);

      return {
        urlName,
        avgPrice: Math.round(avgPrice),
        minPrice,
        maxPrice,
        volume,
        volatility: ((maxPrice - minPrice) / avgPrice * 100).toFixed(2)
      };
    } catch (error) {
      logger.error(`Error getting price history for ${urlName}:`, error.message);
      throw error;
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to wait
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new PriceAnalysisService();
