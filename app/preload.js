const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Inventory operations
  inventory: {
    getAll: () => ipcRenderer.invoke('inventory:getAll'),
    add: (itemData) => ipcRenderer.invoke('inventory:add', itemData),
    update: (urlName, updates) => ipcRenderer.invoke('inventory:update', urlName, updates),
    remove: (urlName) => ipcRenderer.invoke('inventory:remove', urlName),
    updateQuantity: (urlName, quantity) => ipcRenderer.invoke('inventory:updateQuantity', urlName, quantity),
    toggleAutoList: (urlName) => ipcRenderer.invoke('inventory:toggleAutoList', urlName),
    toggleAutoSell: (urlName) => ipcRenderer.invoke('inventory:toggleAutoSell', urlName),
    toggleAutoBuy: (urlName) => ipcRenderer.invoke('inventory:toggleAutoBuy', urlName),
    setPriceConstraints: (urlName, minSell, maxBuy) => ipcRenderer.invoke('inventory:setPriceConstraints', urlName, minSell, maxBuy),
    analyzeAll: () => ipcRenderer.invoke('inventory:analyzeAll'),
    applyRecommendedPrices: () => ipcRenderer.invoke('inventory:applyRecommendedPrices')
  },
  
  // Capital operations
  capital: {
    get: () => ipcRenderer.invoke('capital:get'),
    setPlatinum: (amount) => ipcRenderer.invoke('capital:setPlatinum', amount),
    setCredits: (amount) => ipcRenderer.invoke('capital:setCredits', amount),
    addPlatinum: (amount, reason) => ipcRenderer.invoke('capital:addPlatinum', amount, reason),
    subtractPlatinum: (amount, reason) => ipcRenderer.invoke('capital:subtractPlatinum', amount, reason),
    getHistory: (limit) => ipcRenderer.invoke('capital:getHistory', limit),
    reset: () => ipcRenderer.invoke('capital:reset')
  },
  
  // Trade History operations
  tradeHistory: {
    getAll: (limit) => ipcRenderer.invoke('tradeHistory:getAll', limit),
    recordSale: (itemName, urlName, quantity, price, buyer) => 
      ipcRenderer.invoke('tradeHistory:recordSale', itemName, urlName, quantity, price, buyer),
    recordPurchase: (itemName, urlName, quantity, price, seller) => 
      ipcRenderer.invoke('tradeHistory:recordPurchase', itemName, urlName, quantity, price, seller),
    getSales: (limit) => ipcRenderer.invoke('tradeHistory:getSales', limit),
    getPurchases: (limit) => ipcRenderer.invoke('tradeHistory:getPurchases', limit),
    getToday: () => ipcRenderer.invoke('tradeHistory:getToday'),
    getTodayStats: () => ipcRenderer.invoke('tradeHistory:getTodayStats'),
    getItemHistory: (urlName) => ipcRenderer.invoke('tradeHistory:getItemHistory', urlName),
    delete: (tradeId) => ipcRenderer.invoke('tradeHistory:delete', tradeId),
    clear: () => ipcRenderer.invoke('tradeHistory:clear')
  },
  
  // Market operations
  market: {
    search: (query) => ipcRenderer.invoke('market:search', query),
    analyze: (urlName) => ipcRenderer.invoke('market:analyze', urlName),
    getTrending: (urlName) => ipcRenderer.invoke('market:getTrending', urlName)
  },
  
  // Configuration
  config: {
    get: () => ipcRenderer.invoke('config:get')
  },
  
  // Bot control
  bot: {
    start: () => ipcRenderer.invoke('bot:start'),
    stop: () => ipcRenderer.invoke('bot:stop'),
    status: () => ipcRenderer.invoke('bot:status')
  }
});
