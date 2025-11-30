const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const INVENTORY_FILE = path.join(__dirname, '../../data/inventory.json');

/**
 * Inventory Management Service
 * Manages the user's tradeable inventory
 */
class InventoryService {
  constructor() {
    this.inventory = [];
    this.ensureDataDirectory();
    this.loadInventory();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(INVENTORY_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Load inventory from file
   */
  loadInventory() {
    try {
      if (fs.existsSync(INVENTORY_FILE)) {
        const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
        this.inventory = JSON.parse(data);
        logger.info(`Loaded ${this.inventory.length} items from inventory`);
      } else {
        this.inventory = [];
        this.saveInventory();
        logger.info('Created new inventory file');
      }
    } catch (error) {
      logger.error('Error loading inventory:', error.message);
      this.inventory = [];
    }
  }

  /**
   * Save inventory to file
   */
  saveInventory() {
    try {
      fs.writeFileSync(INVENTORY_FILE, JSON.stringify(this.inventory, null, 2));
      logger.info('Inventory saved');
    } catch (error) {
      logger.error('Error saving inventory:', error.message);
    }
  }

  /**
   * Get all inventory items
   * @returns {Array} All inventory items
   */
  getAllItems() {
    return this.inventory;
  }

  /**
   * Get a specific item by URL name
   * @param {string} urlName - The URL name of the item
   * @returns {Object|null} The item or null
   */
  getItem(urlName) {
    return this.inventory.find(item => item.urlName === urlName) || null;
  }

  /**
   * Add or update an item in inventory
   * @param {Object} item - Item data
   */
  addItem(item) {
    const existingIndex = this.inventory.findIndex(i => i.urlName === item.urlName);
    
    const inventoryItem = {
      urlName: item.urlName,
      itemName: item.itemName || item.urlName.replace(/_/g, ' '),
      quantity: item.quantity || 1,
      minSellPrice: item.minSellPrice || null,
      maxBuyPrice: item.maxBuyPrice || null,
      autoList: item.autoList !== false,
      addedAt: item.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.inventory[existingIndex] = {
        ...this.inventory[existingIndex],
        ...inventoryItem,
        addedAt: this.inventory[existingIndex].addedAt
      };
      logger.info(`Updated item: ${inventoryItem.itemName}`);
    } else {
      this.inventory.push(inventoryItem);
      logger.info(`Added item: ${inventoryItem.itemName}`);
    }

    this.saveInventory();
    return inventoryItem;
  }

  /**
   * Remove an item from inventory
   * @param {string} urlName - The URL name of the item
   * @returns {boolean} True if removed, false if not found
   */
  removeItem(urlName) {
    const index = this.inventory.findIndex(i => i.urlName === urlName);
    if (index >= 0) {
      const removed = this.inventory.splice(index, 1)[0];
      this.saveInventory();
      logger.info(`Removed item: ${removed.itemName}`);
      return true;
    }
    return false;
  }

  /**
   * Update item quantity
   * @param {string} urlName - The URL name of the item
   * @param {number} quantity - New quantity
   * @returns {Object|null} Updated item or null
   */
  updateQuantity(urlName, quantity) {
    const item = this.getItem(urlName);
    if (item) {
      item.quantity = quantity;
      item.updatedAt = new Date().toISOString();
      this.saveInventory();
      logger.info(`Updated quantity for ${item.itemName}: ${quantity}`);
      return item;
    }
    return null;
  }

  /**
   * Get items that need price updates
   * @returns {Array} Items with autoList enabled
   */
  getAutoListItems() {
    return this.inventory.filter(item => item.autoList);
  }

  /**
   * Set price constraints for an item
   * @param {string} urlName - The URL name of the item
   * @param {number} minSellPrice - Minimum sell price
   * @param {number} maxBuyPrice - Maximum buy price
   * @returns {Object|null} Updated item or null
   */
  setPriceConstraints(urlName, minSellPrice, maxBuyPrice) {
    const item = this.getItem(urlName);
    if (item) {
      item.minSellPrice = minSellPrice;
      item.maxBuyPrice = maxBuyPrice;
      item.updatedAt = new Date().toISOString();
      this.saveInventory();
      logger.info(`Set price constraints for ${item.itemName}: min sell ${minSellPrice}p, max buy ${maxBuyPrice}p`);
      return item;
    }
    return null;
  }

  /**
   * Import items from a list
   * @param {Array} items - Array of item data
   */
  importItems(items) {
    items.forEach(item => this.addItem(item));
    logger.info(`Imported ${items.length} items`);
  }

  /**
   * Export inventory to JSON
   * @returns {string} JSON string
   */
  exportInventory() {
    return JSON.stringify(this.inventory, null, 2);
  }
}

module.exports = new InventoryService();
