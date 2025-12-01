const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Get the appropriate data directory for the application
 */
function getDataDirectory() {
  return path.join(__dirname, '../../data');
}

const DATA_DIR = getDataDirectory();
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

/**
 * Transaction History Service
 * Tracks all buy and sell transactions
 */
class TransactionsService {
  constructor() {
    this.transactions = [];
    this.ensureDataDirectory();
    this.loadTransactions();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(TRANSACTIONS_FILE);
    
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
   * Load transactions from file
   */
  loadTransactions() {
    try {
      if (fs.existsSync(TRANSACTIONS_FILE)) {
        const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
        this.transactions = JSON.parse(data);
        logger.info(`Loaded ${this.transactions.length} transactions`);
      } else {
        this.transactions = [];
        this.saveTransactions();
        logger.info('Created new transactions file');
      }
    } catch (error) {
      logger.error('Error loading transactions:', error.message);
      this.transactions = [];
    }
  }

  /**
   * Save transactions to file
   */
  saveTransactions() {
    try {
      fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(this.transactions, null, 2));
      logger.info('Transactions saved');
    } catch (error) {
      logger.error('Error saving transactions:', error.message);
    }
  }

  /**
   * Add a new transaction
   * @param {Object} transaction - Transaction data
   * @param {string} transaction.type - 'buy' or 'sell'
   * @param {string} transaction.urlName - Item URL name
   * @param {string} transaction.itemName - Item display name
   * @param {number} transaction.quantity - Number of items
   * @param {number} transaction.pricePerUnit - Price per item
   * @param {number} transaction.totalPrice - Total transaction price
   * @param {string} transaction.buyer - Buyer username (for sells)
   * @param {string} transaction.seller - Seller username (for buys)
   * @returns {Object} The added transaction
   */
  addTransaction(transaction) {
    const newTransaction = {
      id: this.generateId(),
      type: transaction.type, // 'buy' or 'sell'
      urlName: transaction.urlName,
      itemName: transaction.itemName,
      quantity: transaction.quantity || 1,
      pricePerUnit: transaction.pricePerUnit,
      totalPrice: transaction.totalPrice || (transaction.pricePerUnit * (transaction.quantity || 1)),
      buyer: transaction.buyer || null,
      seller: transaction.seller || null,
      timestamp: new Date().toISOString()
    };

    this.transactions.unshift(newTransaction); // Add to beginning
    
    // Keep only last 500 transactions
    if (this.transactions.length > 500) {
      this.transactions = this.transactions.slice(0, 500);
    }
    
    this.saveTransactions();
    logger.info(`Added ${transaction.type} transaction: ${transaction.itemName} x${newTransaction.quantity} @ ${newTransaction.pricePerUnit}p`);
    return newTransaction;
  }

  /**
   * Record a sale
   */
  recordSale(urlName, itemName, quantity, pricePerUnit, buyer = null) {
    return this.addTransaction({
      type: 'sell',
      urlName,
      itemName,
      quantity,
      pricePerUnit,
      buyer
    });
  }

  /**
   * Record a purchase
   */
  recordPurchase(urlName, itemName, quantity, pricePerUnit, seller = null) {
    return this.addTransaction({
      type: 'buy',
      urlName,
      itemName,
      quantity,
      pricePerUnit,
      seller
    });
  }

  /**
   * Get all transactions
   * @param {number} limit - Maximum number to return
   * @returns {Array} Transactions
   */
  getTransactions(limit = 50) {
    return this.transactions.slice(0, limit);
  }

  /**
   * Get transactions by type
   * @param {string} type - 'buy' or 'sell'
   * @param {number} limit - Maximum number to return
   * @returns {Array} Transactions
   */
  getTransactionsByType(type, limit = 50) {
    return this.transactions.filter(t => t.type === type).slice(0, limit);
  }

  /**
   * Get transactions for a specific item
   * @param {string} urlName - Item URL name
   * @param {number} limit - Maximum number to return
   * @returns {Array} Transactions
   */
  getTransactionsForItem(urlName, limit = 50) {
    return this.transactions.filter(t => t.urlName === urlName).slice(0, limit);
  }

  /**
   * Get transaction statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const today = new Date().toDateString();
    const todayTransactions = this.transactions.filter(t => 
      new Date(t.timestamp).toDateString() === today
    );

    const totalSales = this.transactions.filter(t => t.type === 'sell');
    const totalPurchases = this.transactions.filter(t => t.type === 'buy');
    const todaySales = todayTransactions.filter(t => t.type === 'sell');
    const todayPurchases = todayTransactions.filter(t => t.type === 'buy');

    return {
      totalTransactions: this.transactions.length,
      totalSales: totalSales.length,
      totalPurchases: totalPurchases.length,
      totalSalesValue: totalSales.reduce((sum, t) => sum + t.totalPrice, 0),
      totalPurchasesValue: totalPurchases.reduce((sum, t) => sum + t.totalPrice, 0),
      todayTransactions: todayTransactions.length,
      todaySales: todaySales.length,
      todayPurchases: todayPurchases.length,
      todaySalesValue: todaySales.reduce((sum, t) => sum + t.totalPrice, 0),
      todayPurchasesValue: todayPurchases.reduce((sum, t) => sum + t.totalPrice, 0),
      todayProfit: todaySales.reduce((sum, t) => sum + t.totalPrice, 0) - 
                  todayPurchases.reduce((sum, t) => sum + t.totalPrice, 0)
    };
  }

  /**
   * Clear all transactions
   */
  clearAll() {
    this.transactions = [];
    this.saveTransactions();
    logger.info('All transactions cleared');
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new TransactionsService();
