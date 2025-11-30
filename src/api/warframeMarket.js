const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Warframe Market API v2 Client
 * Handles all interactions with the warframe.market API v2
 * 
 * API Documentation: https://42bytes.notion.site/WFM-Api-v2-Documentation-5d987e4aa2f74b55a80db1a09932459d
 * 
 * Rate limit: 3 requests per second
 * Response structure: { apiVersion, data, error }
 */
class WarframeMarketAPI {
  constructor() {
    this.baseUrl = config.warframeMarket.baseUrl;
    this.staticAssetsUrl = config.warframeMarket.staticAssetsUrl;
    this.jwt = config.warframeMarket.jwt;
    this.platform = config.warframeMarket.platform;
    this.crossplay = config.warframeMarket.crossplay;
    this.rateLimit = config.warframeMarket.rateLimit;
    
    // Rate limiting state
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000 / this.rateLimit; // ~333ms between requests
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Platform': this.platform,
        'Crossplay': String(this.crossplay),
        'Language': 'en'
      }
    });

    // Add JWT to requests if available
    if (this.jwt) {
      this.client.defaults.headers.common['Authorization'] = `JWT ${this.jwt}`;
    }

    // Add response interceptor to handle v2 response format
    this.client.interceptors.response.use(
      (response) => {
        // v2 API wraps response in { apiVersion, data, error }
        if (response.data && response.data.data !== undefined) {
          return { ...response, data: response.data };
        }
        return response;
      },
      (error) => {
        // Handle rate limiting (429) and bandwidth exceeded (509)
        if (error.response) {
          if (error.response.status === 429) {
            logger.warn('Rate limit exceeded. Consider reducing request frequency.');
          } else if (error.response.status === 509) {
            logger.warn('Too many concurrent connections from this IP.');
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Rate-limited request wrapper
   * Ensures we don't exceed 3 requests per second
   */
  async rateLimitedRequest(requestFn) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await this.delay(this.minRequestInterval - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
    return requestFn();
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to wait
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get full URL for a static asset (item icon, avatar, etc.)
   * @param {string} path - Asset path from API response
   * @returns {string} Full URL to the asset
   */
  getAssetUrl(path) {
    if (!path) return null;
    return `${this.staticAssetsUrl}${path}`;
  }

  /**
   * Get API version info and resource versions
   * @returns {Promise<Object>} Version information
   */
  async getVersions() {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get('/versions')
      );
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching versions:', error.message);
      throw error;
    }
  }

  /**
   * Get all tradeable items from the market (v2 endpoint)
   * @returns {Promise<Array>} List of items
   */
  async getAllItems() {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get('/items')
      );
      // v2 returns data directly as array
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching items:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific item (v2 endpoint)
   * @param {string} slug - The slug/URL name of the item
   * @returns {Promise<Object>} Item details
   */
  async getItemInfo(slug) {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get(`/item/${slug}`)
      );
      return response.data.data;
    } catch (error) {
      logger.error(`Error fetching item info for ${slug}:`, error.message);
      throw error;
    }
  }

  /**
   * Get orders for a specific item
   * @param {string} slug - The slug of the item
   * @returns {Promise<Object>} Buy and sell orders
   */
  async getItemOrders(slug) {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get(`/orders/item/${slug}`)
      );
      const orders = response.data.data || [];
      
      // Filter for online users and sort by price
      const sellOrders = orders
        .filter(o => o.orderType === 'sell' && o.user && o.user.status === 'ingame')
        .sort((a, b) => a.platinum - b.platinum);
      
      const buyOrders = orders
        .filter(o => o.orderType === 'buy' && o.user && o.user.status === 'ingame')
        .sort((a, b) => b.platinum - a.platinum);

      return { sellOrders, buyOrders };
    } catch (error) {
      logger.error(`Error fetching orders for ${slug}:`, error.message);
      throw error;
    }
  }

  /**
   * Get statistics for an item (price history)
   * @param {string} slug - The slug of the item
   * @returns {Promise<Object>} Item statistics
   */
  async getItemStatistics(slug) {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get(`/items/${slug}/statistics`)
      );
      return response.data.data;
    } catch (error) {
      logger.error(`Error fetching statistics for ${slug}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current user's profile
   * @returns {Promise<Object>} User profile
   */
  async getMyProfile() {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get('/profile')
      );
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching profile:', error.message);
      throw error;
    }
  }

  /**
   * Get current user's orders
   * @returns {Promise<Object>} User's orders
   */
  async getMyOrders() {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.get('/profile/orders')
      );
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching my orders:', error.message);
      throw error;
    }
  }

  /**
   * Create a new order
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Created order
   */
  async createOrder(orderData) {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.post('/profile/orders', orderData)
      );
      logger.info(`Created ${orderData.orderType} order for ${orderData.item} at ${orderData.platinum}p`);
      return response.data.data;
    } catch (error) {
      logger.error('Error creating order:', error.message);
      // Handle v2 error format
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        if (apiError.request) {
          logger.error('API errors:', apiError.request.join(', '));
        }
        if (apiError.inputs) {
          logger.error('Input errors:', JSON.stringify(apiError.inputs));
        }
      }
      throw error;
    }
  }

  /**
   * Update an existing order
   * @param {string} orderId - The order ID to update
   * @param {Object} updateData - Updated order details
   * @returns {Promise<Object>} Updated order
   */
  async updateOrder(orderId, updateData) {
    try {
      const response = await this.rateLimitedRequest(() => 
        this.client.put(`/profile/orders/${orderId}`, updateData)
      );
      logger.info(`Updated order ${orderId} to ${updateData.platinum}p`);
      return response.data.data;
    } catch (error) {
      logger.error(`Error updating order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete an order
   * @param {string} orderId - The order ID to delete
   * @returns {Promise<void>}
   */
  async deleteOrder(orderId) {
    try {
      await this.rateLimitedRequest(() => 
        this.client.delete(`/profile/orders/${orderId}`)
      );
      logger.info(`Deleted order ${orderId}`);
    } catch (error) {
      logger.error(`Error deleting order ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Set user status (online, offline, invisible)
   * @param {string} status - User status
   * @returns {Promise<void>}
   */
  async setUserStatus(status) {
    try {
      await this.rateLimitedRequest(() => 
        this.client.post('/auth/signin', { status })
      );
      logger.info(`Set user status to ${status}`);
    } catch (error) {
      logger.error('Error setting user status:', error.message);
      throw error;
    }
  }

  /**
   * Calculate best buy and sell prices for an item
   * @param {string} slug - The slug of the item
   * @returns {Promise<Object>} Best prices and profit margin
   */
  async calculateBestPrices(slug) {
    try {
      const { sellOrders, buyOrders } = await this.getItemOrders(slug);
      
      const lowestSell = sellOrders.length > 0 ? sellOrders[0].platinum : null;
      const highestBuy = buyOrders.length > 0 ? buyOrders[0].platinum : null;
      
      // Calculate optimal prices
      const optimalSellPrice = lowestSell ? lowestSell - config.trading.sellUndercutAmount : null;
      const optimalBuyPrice = highestBuy ? highestBuy + config.trading.buyOvercutAmount : null;
      
      // Calculate profit margin if both exist
      let profitMargin = null;
      let profitPercentage = null;
      if (lowestSell && highestBuy) {
        profitMargin = lowestSell - highestBuy;
        profitPercentage = ((profitMargin / highestBuy) * 100).toFixed(2);
      }

      return {
        itemName: slug,
        lowestSell,
        highestBuy,
        optimalSellPrice,
        optimalBuyPrice,
        profitMargin,
        profitPercentage,
        sellOrderCount: sellOrders.length,
        buyOrderCount: buyOrders.length
      };
    } catch (error) {
      logger.error(`Error calculating best prices for ${slug}:`, error.message);
      throw error;
    }
  }
}

module.exports = new WarframeMarketAPI();
