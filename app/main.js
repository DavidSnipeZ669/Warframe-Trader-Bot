const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import services
const inventoryService = require('../src/services/inventory');
const capitalService = require('../src/services/capital');
const tradeHistoryService = require('../src/services/tradeHistory');
const priceAnalysisService = require('../src/services/priceAnalysis');
const marketAutomationService = require('../src/services/marketAutomation');
const notificationService = require('../src/services/notification');
const warframeMarket = require('../src/api/warframeMarket');
const config = require('../src/config');
const logger = require('../src/utils/logger');

// Constants
const RATE_LIMIT_DELAY_MS = 350; // Delay between API calls for rate limiting

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Warframe Trader Bot'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for inventory management

// Get all inventory items
ipcMain.handle('inventory:getAll', async () => {
  return inventoryService.getAllItems();
});

// Add item to inventory
ipcMain.handle('inventory:add', async (event, itemData) => {
  return inventoryService.addItem(itemData);
});

// Update item in inventory
ipcMain.handle('inventory:update', async (event, urlName, updates) => {
  const item = inventoryService.getItem(urlName);
  if (item) {
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    inventoryService.saveInventory();
    return item;
  }
  return null;
});

// Remove item from inventory
ipcMain.handle('inventory:remove', async (event, urlName) => {
  return inventoryService.removeItem(urlName);
});

// Update item quantity
ipcMain.handle('inventory:updateQuantity', async (event, urlName, quantity) => {
  return inventoryService.updateQuantity(urlName, quantity);
});

// Toggle auto-list for an item (legacy - toggles autoSell)
// @deprecated Use inventory:toggleAutoSell instead
ipcMain.handle('inventory:toggleAutoList', async (event, urlName) => {
  logger.warn(`inventory:toggleAutoList is deprecated, use inventory:toggleAutoSell instead`);
  return inventoryService.toggleAutoSell(urlName);
});

// Toggle auto-sell for an item
ipcMain.handle('inventory:toggleAutoSell', async (event, urlName) => {
  return inventoryService.toggleAutoSell(urlName);
});

// Toggle auto-buy for an item
ipcMain.handle('inventory:toggleAutoBuy', async (event, urlName) => {
  return inventoryService.toggleAutoBuy(urlName);
});

// Set price constraints
ipcMain.handle('inventory:setPriceConstraints', async (event, urlName, minSellPrice, maxBuyPrice) => {
  return inventoryService.setPriceConstraints(urlName, minSellPrice, maxBuyPrice);
});

// Item cache for search
let itemCache = null;
let itemCacheTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Search for items on Warframe Market
ipcMain.handle('market:search', async (event, query) => {
  try {
    // Use cache if available and not expired
    const now = Date.now();
    if (!itemCache || (now - itemCacheTime) > CACHE_DURATION_MS) {
      logger.info('Fetching items from Warframe Market API...');
      itemCache = await warframeMarket.getAllItems();
      itemCacheTime = now;
      logger.info(`Cached ${itemCache ? itemCache.length : 0} items`);
    }
    
    if (!itemCache || itemCache.length === 0) {
      return { error: 'Could not fetch items from Warframe Market. Please check your internet connection.' };
    }
    
    const matches = itemCache.filter(item => {
      // v2 API uses 'i18n' for localized names and 'slug' for URL names
      const itemName = item.item_name || item.i18n?.en?.item_name || '';
      const urlName = item.url_name || item.slug || '';
      const queryLower = query.toLowerCase();
      return itemName.toLowerCase().includes(queryLower) || urlName.toLowerCase().includes(queryLower);
    }).slice(0, 20);
    
    // Map to consistent format
    return matches.map(item => ({
      item_name: item.item_name || item.i18n?.en?.item_name || item.slug?.replace(/_/g, ' ') || 'Unknown',
      url_name: item.url_name || item.slug || item.id
    }));
  } catch (error) {
    logger.error('Search error:', error.message);
    return { error: `Search failed: ${error.message}. Please check your internet connection.` };
  }
});

// Analyze item prices
ipcMain.handle('market:analyze', async (event, urlName) => {
  try {
    const analysis = await priceAnalysisService.analyzeItem(urlName);
    return analysis;
  } catch (error) {
    logger.error('Analysis error:', error.message);
    return null;
  }
});

// Get configuration
ipcMain.handle('config:get', async () => {
  return {
    autoListingEnabled: config.trading.autoListingEnabled,
    priceCheckInterval: config.trading.priceCheckInterval,
    minProfitPercentage: config.trading.minProfitPercentage,
    sellUndercutAmount: config.trading.sellUndercutAmount,
    buyOvercutAmount: config.trading.buyOvercutAmount,
    maxPlatinum: config.trading.maxPlatinum
  };
});

// Bot control
let botRunning = false;
let cronJob = null;

ipcMain.handle('bot:start', async () => {
  if (!botRunning) {
    await marketAutomationService.start();
    botRunning = true;
    logger.info('Bot started from GUI');
    return { success: true, message: 'Bot started' };
  }
  return { success: false, message: 'Bot already running' };
});

ipcMain.handle('bot:stop', async () => {
  if (botRunning) {
    await marketAutomationService.stop();
    botRunning = false;
    logger.info('Bot stopped from GUI');
    return { success: true, message: 'Bot stopped' };
  }
  return { success: false, message: 'Bot not running' };
});

ipcMain.handle('bot:status', async () => {
  return { running: botRunning };
});

// Analyze all inventory items and return recommended prices
ipcMain.handle('inventory:analyzeAll', async () => {
  const items = inventoryService.getAllItems();
  const results = [];
  
  for (const item of items) {
    try {
      const analysis = await priceAnalysisService.analyzeItem(item.urlName);
      results.push({
        urlName: item.urlName,
        itemName: item.itemName,
        quantity: item.quantity,
        currentMinSell: item.minSellPrice,
        currentMaxBuy: item.maxBuyPrice,
        recommendedSell: analysis.optimalSellPrice || analysis.lowestSell,
        recommendedBuy: analysis.optimalBuyPrice || analysis.highestBuy,
        lowestSell: analysis.lowestSell,
        highestBuy: analysis.highestBuy,
        autoList: item.autoList
      });
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    } catch (error) {
      logger.error(`Error analyzing ${item.urlName}:`, error.message);
      results.push({
        urlName: item.urlName,
        itemName: item.itemName,
        error: error.message
      });
    }
  }
  
  return results;
});

// Apply recommended prices to all items
ipcMain.handle('inventory:applyRecommendedPrices', async () => {
  const items = inventoryService.getAllItems();
  const updated = [];
  
  for (const item of items) {
    try {
      const analysis = await priceAnalysisService.analyzeItem(item.urlName);
      const recSell = analysis.optimalSellPrice || analysis.lowestSell;
      const recBuy = analysis.optimalBuyPrice || analysis.highestBuy;
      
      if (recSell || recBuy) {
        inventoryService.setPriceConstraints(item.urlName, recSell, recBuy);
        updated.push({
          urlName: item.urlName,
          itemName: item.itemName,
          minSellPrice: recSell,
          maxBuyPrice: recBuy
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    } catch (error) {
      logger.error(`Error applying prices to ${item.urlName}:`, error.message);
    }
  }
  
  return updated;
});

// Capital Management IPC Handlers

// Get current capital
ipcMain.handle('capital:get', async () => {
  return capitalService.getCapital();
});

// Set platinum amount
ipcMain.handle('capital:setPlatinum', async (event, amount) => {
  return capitalService.setPlatinum(amount);
});

// Set credits amount
ipcMain.handle('capital:setCredits', async (event, amount) => {
  return capitalService.setCredits(amount);
});

// Add platinum (from a sale)
ipcMain.handle('capital:addPlatinum', async (event, amount, reason) => {
  return capitalService.addPlatinum(amount, reason);
});

// Subtract platinum (from a purchase)
ipcMain.handle('capital:subtractPlatinum', async (event, amount, reason) => {
  return capitalService.subtractPlatinum(amount, reason);
});

// Get capital history
ipcMain.handle('capital:getHistory', async (event, limit) => {
  return capitalService.getHistory(limit);
});

// Reset capital
ipcMain.handle('capital:reset', async () => {
  return capitalService.reset();
});

// Trade History IPC Handlers

// Get trade history
ipcMain.handle('tradeHistory:getAll', async (event, limit) => {
  return tradeHistoryService.getHistory(limit);
});

// Record a sale
ipcMain.handle('tradeHistory:recordSale', async (event, itemName, urlName, quantity, price, buyer) => {
  return tradeHistoryService.recordSale(itemName, urlName, quantity, price, buyer);
});

// Record a purchase
ipcMain.handle('tradeHistory:recordPurchase', async (event, itemName, urlName, quantity, price, seller) => {
  return tradeHistoryService.recordPurchase(itemName, urlName, quantity, price, seller);
});

// Get sales only
ipcMain.handle('tradeHistory:getSales', async (event, limit) => {
  return tradeHistoryService.getSales(limit);
});

// Get purchases only
ipcMain.handle('tradeHistory:getPurchases', async (event, limit) => {
  return tradeHistoryService.getPurchases(limit);
});

// Get today's trades
ipcMain.handle('tradeHistory:getToday', async () => {
  return tradeHistoryService.getTodayTrades();
});

// Get today's statistics
ipcMain.handle('tradeHistory:getTodayStats', async () => {
  return tradeHistoryService.getTodayStats();
});

// Get history for specific item
ipcMain.handle('tradeHistory:getItemHistory', async (event, urlName) => {
  return tradeHistoryService.getItemHistory(urlName);
});

// Delete a trade entry
ipcMain.handle('tradeHistory:delete', async (event, tradeId) => {
  return tradeHistoryService.deleteTrade(tradeId);
});

// Clear all history
ipcMain.handle('tradeHistory:clear', async () => {
  tradeHistoryService.clearHistory();
  return { success: true };
});

// Market Trending IPC Handler
ipcMain.handle('market:getTrending', async (event, urlName) => {
  try {
    // Get statistics from the API to determine trending
    const stats = await warframeMarket.getItemStatistics(urlName);
    
    if (!stats) {
      return { error: 'Could not fetch statistics' };
    }
    
    // Calculate 7-day price trend
    const history = stats.statistics_closed?.['90days'] || stats.statistics_live?.['90days'] || [];
    
    if (history.length < 2) {
      return { trend: 'stable', change: 0, history: [] };
    }
    
    // Get last 7 days of data
    const last7Days = history.slice(-7);
    const last14Days = history.slice(-14, -7);
    
    const recentAvg = last7Days.reduce((sum, d) => sum + (d.avg_price || d.median || 0), 0) / last7Days.length;
    const previousAvg = last14Days.length > 0 
      ? last14Days.reduce((sum, d) => sum + (d.avg_price || d.median || 0), 0) / last14Days.length
      : recentAvg;
    
    const change = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
    
    let trend = 'stable';
    if (change > 5) trend = 'rising';
    else if (change > 2) trend = 'slight_rise';
    else if (change < -5) trend = 'falling';
    else if (change < -2) trend = 'slight_fall';
    
    // Return trending data
    return {
      trend,
      change: Math.round(change * 10) / 10,
      recentAvg: Math.round(recentAvg),
      previousAvg: Math.round(previousAvg),
      volume: last7Days.reduce((sum, d) => sum + (d.volume || 0), 0),
      history: last7Days.map(d => ({
        date: d.datetime,
        price: d.avg_price || d.median || 0,
        volume: d.volume || 0
      }))
    };
  } catch (error) {
    logger.error('Error getting trending data:', error.message);
    return { error: error.message };
  }
});
