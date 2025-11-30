const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import services
const inventoryService = require('../src/services/inventory');
const capitalService = require('../src/services/capital');
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

// Toggle auto-list for an item
ipcMain.handle('inventory:toggleAutoList', async (event, urlName) => {
  const item = inventoryService.getItem(urlName);
  if (item) {
    item.autoList = !item.autoList;
    item.updatedAt = new Date().toISOString();
    inventoryService.saveInventory();
    return item;
  }
  return null;
});

// Set price constraints
ipcMain.handle('inventory:setPriceConstraints', async (event, urlName, minSellPrice, maxBuyPrice) => {
  return inventoryService.setPriceConstraints(urlName, minSellPrice, maxBuyPrice);
});

// Search for items on Warframe Market
ipcMain.handle('market:search', async (event, query) => {
  try {
    const allItems = await warframeMarket.getAllItems();
    const matches = allItems.filter(item => 
      (item.item_name && item.item_name.toLowerCase().includes(query.toLowerCase())) ||
      (item.url_name && item.url_name.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 20);
    return matches;
  } catch (error) {
    logger.error('Search error:', error.message);
    return [];
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
