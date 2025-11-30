const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Get the appropriate data directory for the application
 * Always uses a local 'data' directory in the app folder for reliability
 */
function getDataDirectory() {
  // Use local data directory in app folder - most reliable approach
  // This works in both CLI and Electron modes
  const localDataDir = path.join(__dirname, '../../data');
  return localDataDir;
}

const DATA_DIR = getDataDirectory();
const CAPITAL_FILE = path.join(DATA_DIR, 'capital.json');

/**
 * Capital Management Service
 * Tracks user's platinum and credits
 */
class CapitalService {
  constructor() {
    this.capital = {
      platinum: 0,
      credits: 0,
      updatedAt: null,
      history: []
    };
    this.ensureDataDirectory();
    this.loadCapital();
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(CAPITAL_FILE);
    
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
   * Load capital from file
   */
  loadCapital() {
    try {
      if (fs.existsSync(CAPITAL_FILE)) {
        const data = fs.readFileSync(CAPITAL_FILE, 'utf8');
        this.capital = JSON.parse(data);
        logger.info(`Loaded capital: ${this.capital.platinum}p, ${this.capital.credits}c`);
      } else {
        this.capital = {
          platinum: 0,
          credits: 0,
          updatedAt: new Date().toISOString(),
          history: []
        };
        this.saveCapital();
        logger.info('Created new capital file');
      }
    } catch (error) {
      logger.error('Error loading capital:', error.message);
      this.capital = {
        platinum: 0,
        credits: 0,
        updatedAt: null,
        history: []
      };
    }
  }

  /**
   * Save capital to file
   */
  saveCapital() {
    try {
      fs.writeFileSync(CAPITAL_FILE, JSON.stringify(this.capital, null, 2));
      logger.info('Capital saved');
    } catch (error) {
      logger.error('Error saving capital:', error.message);
    }
  }

  /**
   * Get current capital
   * @returns {Object} Current platinum and credits
   */
  getCapital() {
    return {
      platinum: this.capital.platinum,
      credits: this.capital.credits,
      updatedAt: this.capital.updatedAt
    };
  }

  /**
   * Set platinum amount
   * @param {number} amount - New platinum amount
   * @returns {Object} Updated capital
   */
  setPlatinum(amount) {
    const oldAmount = this.capital.platinum;
    this.capital.platinum = Math.max(0, Math.floor(amount));
    this.capital.updatedAt = new Date().toISOString();
    
    // Add to history
    if (oldAmount !== this.capital.platinum) {
      this.addHistoryEntry('platinum', oldAmount, this.capital.platinum);
    }
    
    this.saveCapital();
    logger.info(`Platinum set to ${this.capital.platinum}p (was ${oldAmount}p)`);
    return this.getCapital();
  }

  /**
   * Set credits amount
   * @param {number} amount - New credits amount
   * @returns {Object} Updated capital
   */
  setCredits(amount) {
    const oldAmount = this.capital.credits;
    this.capital.credits = Math.max(0, Math.floor(amount));
    this.capital.updatedAt = new Date().toISOString();
    
    // Add to history
    if (oldAmount !== this.capital.credits) {
      this.addHistoryEntry('credits', oldAmount, this.capital.credits);
    }
    
    this.saveCapital();
    logger.info(`Credits set to ${this.capital.credits}c (was ${oldAmount}c)`);
    return this.getCapital();
  }

  /**
   * Add platinum (e.g., from a sale)
   * @param {number} amount - Amount to add
   * @param {string} reason - Reason for the change
   * @returns {Object} Updated capital
   */
  addPlatinum(amount, reason = '') {
    const oldAmount = this.capital.platinum;
    this.capital.platinum = Math.max(0, this.capital.platinum + Math.floor(amount));
    this.capital.updatedAt = new Date().toISOString();
    
    this.addHistoryEntry('platinum', oldAmount, this.capital.platinum, reason);
    this.saveCapital();
    logger.info(`Added ${amount}p: ${this.capital.platinum}p (was ${oldAmount}p) - ${reason}`);
    return this.getCapital();
  }

  /**
   * Subtract platinum (e.g., from a purchase)
   * @param {number} amount - Amount to subtract
   * @param {string} reason - Reason for the change
   * @returns {Object} Updated capital
   */
  subtractPlatinum(amount, reason = '') {
    const oldAmount = this.capital.platinum;
    this.capital.platinum = Math.max(0, this.capital.platinum - Math.floor(amount));
    this.capital.updatedAt = new Date().toISOString();
    
    this.addHistoryEntry('platinum', oldAmount, this.capital.platinum, reason);
    this.saveCapital();
    logger.info(`Subtracted ${amount}p: ${this.capital.platinum}p (was ${oldAmount}p) - ${reason}`);
    return this.getCapital();
  }

  /**
   * Add history entry for capital changes
   * @param {string} type - 'platinum' or 'credits'
   * @param {number} oldAmount - Previous amount
   * @param {number} newAmount - New amount
   * @param {string} reason - Reason for change
   */
  addHistoryEntry(type, oldAmount, newAmount, reason = '') {
    const entry = {
      type,
      oldAmount,
      newAmount,
      change: newAmount - oldAmount,
      reason,
      timestamp: new Date().toISOString()
    };
    
    // Keep only last 100 history entries
    this.capital.history = this.capital.history || [];
    this.capital.history.unshift(entry);
    if (this.capital.history.length > 100) {
      this.capital.history = this.capital.history.slice(0, 100);
    }
  }

  /**
   * Get capital history
   * @param {number} limit - Number of entries to return
   * @returns {Array} History entries
   */
  getHistory(limit = 20) {
    return (this.capital.history || []).slice(0, limit);
  }

  /**
   * Reset capital to zero
   * @returns {Object} Updated capital
   */
  reset() {
    this.capital = {
      platinum: 0,
      credits: 0,
      updatedAt: new Date().toISOString(),
      history: []
    };
    this.saveCapital();
    logger.info('Capital reset to zero');
    return this.getCapital();
  }
}

module.exports = new CapitalService();
