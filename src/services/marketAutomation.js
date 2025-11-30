const warframeMarket = require('../api/warframeMarket');
const inventoryService = require('./inventory');
const priceAnalysisService = require('./priceAnalysis');
const notificationService = require('./notification');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Market Automation Service
 * Automatically manages market listings with optimal prices
 */
class MarketAutomationService {
  constructor() {
    this.isRunning = false;
    this.activeOrders = new Map();
  }

  /**
   * Start the automation service
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Market automation is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Market automation service started');
    await notificationService.sendStatusNotification('Market automation service started');

    // Load current orders
    await this.loadCurrentOrders();
  }

  /**
   * Stop the automation service
   */
  async stop() {
    this.isRunning = false;
    logger.info('Market automation service stopped');
    await notificationService.sendStatusNotification('Market automation service stopped');
  }

  /**
   * Load current user orders from the market
   */
  async loadCurrentOrders() {
    try {
      const orders = await warframeMarket.getMyOrders();
      
      if (orders.sell_orders) {
        orders.sell_orders.forEach(order => {
          this.activeOrders.set(order.id, {
            ...order,
            type: 'sell'
          });
        });
      }

      if (orders.buy_orders) {
        orders.buy_orders.forEach(order => {
          this.activeOrders.set(order.id, {
            ...order,
            type: 'buy'
          });
        });
      }

      logger.info(`Loaded ${this.activeOrders.size} active orders`);
    } catch (error) {
      logger.error('Error loading current orders:', error.message);
    }
  }

  /**
   * Update all orders to optimal prices
   */
  async updateAllOrders() {
    if (!this.isRunning) {
      logger.warn('Market automation is not running');
      return;
    }

    logger.info('Updating all orders to optimal prices...');
    const updatedOrders = [];

    for (const [orderId, order] of this.activeOrders) {
      try {
        const analysis = await priceAnalysisService.getPrice(order.item.url_name);
        
        let newPrice;
        let shouldUpdate = false;

        if (order.type === 'sell' && analysis.optimalSellPrice) {
          newPrice = analysis.optimalSellPrice;
          shouldUpdate = order.platinum !== newPrice;
        } else if (order.type === 'buy' && analysis.optimalBuyPrice) {
          newPrice = analysis.optimalBuyPrice;
          shouldUpdate = order.platinum !== newPrice;
        }

        if (shouldUpdate && newPrice > 0) {
          await warframeMarket.updateOrder(orderId, {
            platinum: newPrice,
            quantity: order.quantity,
            visible: true
          });

          await notificationService.sendPriceUpdateAlert({
            itemName: order.item.url_name,
            orderType: order.type,
            oldPrice: order.platinum,
            newPrice,
            reason: 'Auto-adjusted to optimal market price'
          });

          order.platinum = newPrice;
          updatedOrders.push({
            orderId,
            item: order.item.url_name,
            type: order.type,
            oldPrice: order.platinum,
            newPrice
          });
        }

        // Delay to avoid rate limiting
        await this.delay(500);
      } catch (error) {
        logger.error(`Error updating order ${orderId}:`, error.message);
      }
    }

    logger.info(`Updated ${updatedOrders.length} orders`);
    return updatedOrders;
  }

  /**
   * Create optimal listings for inventory items
   */
  async createOptimalListings() {
    if (!this.isRunning) {
      logger.warn('Market automation is not running');
      return;
    }

    const autoListItems = inventoryService.getAutoListItems();
    const createdOrders = [];

    for (const item of autoListItems) {
      try {
        const analysis = await priceAnalysisService.analyzeItem(item.urlName);
        
        // Check if we already have an order for this item
        const existingOrder = Array.from(this.activeOrders.values()).find(
          o => o.item.url_name === item.urlName
        );

        if (!existingOrder && item.quantity > 0) {
          // Get item info to get the item_id
          const itemInfo = await warframeMarket.getItemInfo(item.urlName);
          
          // Safety check for items_in_set
          if (!itemInfo || !itemInfo.items_in_set || itemInfo.items_in_set.length === 0) {
            logger.warn(`Could not find item ID for ${item.urlName}`);
            continue;
          }
          
          const itemId = itemInfo.items_in_set[0].id;

          // Create sell order
          if (analysis.optimalSellPrice && (!item.minSellPrice || analysis.optimalSellPrice >= item.minSellPrice)) {
            const order = await warframeMarket.createOrder({
              item: itemId,
              order_type: 'sell',
              platinum: analysis.optimalSellPrice,
              quantity: item.quantity,
              visible: true
            });

            this.activeOrders.set(order.id, {
              ...order,
              type: 'sell'
            });

            createdOrders.push({
              item: item.urlName,
              type: 'sell',
              price: analysis.optimalSellPrice,
              quantity: item.quantity
            });

            await notificationService.sendNotification(
              '📝 New Listing Created',
              `Created sell order for **${item.itemName}** at ${analysis.optimalSellPrice}p`,
              'green'
            );
          }
        }

        await this.delay(500);
      } catch (error) {
        logger.error(`Error creating listing for ${item.urlName}:`, error.message);
      }
    }

    logger.info(`Created ${createdOrders.length} new listings`);
    return createdOrders;
  }

  /**
   * Create a buy order for an item
   * @param {string} urlName - Item URL name
   * @param {number} quantity - Quantity to buy
   * @param {number} maxPrice - Maximum price to pay
   */
  async createBuyOrder(urlName, quantity, maxPrice) {
    try {
      const analysis = await priceAnalysisService.analyzeItem(urlName);
      const itemInfo = await warframeMarket.getItemInfo(urlName);
      
      // Safety check for items_in_set
      if (!itemInfo || !itemInfo.items_in_set || itemInfo.items_in_set.length === 0) {
        throw new Error(`Could not find item ID for ${urlName}`);
      }
      
      const itemId = itemInfo.items_in_set[0].id;

      // Use optimal buy price or max price, whichever is lower
      const price = Math.min(analysis.optimalBuyPrice || maxPrice, maxPrice);

      const order = await warframeMarket.createOrder({
        item: itemId,
        order_type: 'buy',
        platinum: price,
        quantity,
        visible: true
      });

      this.activeOrders.set(order.id, {
        ...order,
        type: 'buy'
      });

      logger.info(`Created buy order for ${urlName} at ${price}p`);

      await notificationService.sendNotification(
        '📥 Buy Order Created',
        `Created buy order for **${urlName.replace(/_/g, ' ')}** at ${price}p x${quantity}`,
        'blue'
      );

      return order;
    } catch (error) {
      logger.error(`Error creating buy order for ${urlName}:`, error.message);
      throw error;
    }
  }

  /**
   * Monitor for profitable trade opportunities
   */
  async monitorProfitableTrades() {
    if (!this.isRunning) return;

    logger.info('Monitoring for profitable trades...');

    const inventoryItems = inventoryService.getAllItems();
    const urlNames = inventoryItems.map(i => i.urlName);

    const opportunities = await priceAnalysisService.findProfitableTrades(urlNames);

    for (const opportunity of opportunities) {
      await notificationService.sendProfitableTradeAlert(opportunity);
    }

    return opportunities;
  }

  /**
   * Run a complete automation cycle
   */
  async runCycle() {
    if (!this.isRunning) {
      logger.warn('Market automation is not running');
      return;
    }

    logger.info('Running automation cycle...');

    try {
      // 1. Load latest orders
      await this.loadCurrentOrders();

      // 2. Update existing orders
      await this.updateAllOrders();

      // 3. Create new listings if enabled
      if (config.trading.autoListingEnabled) {
        await this.createOptimalListings();
      }

      // 4. Monitor for profitable trades
      await this.monitorProfitableTrades();

      logger.info('Automation cycle complete');
    } catch (error) {
      logger.error('Error in automation cycle:', error.message);
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new MarketAutomationService();
