// Warframe Trader Bot - Renderer Script

// Constants
const MAX_MASTERY_RANK = 35;

/**
 * Convert an item name to URL slug format
 * @param {string} name - Item name (e.g., "Volt Prime Set")
 * @returns {string} URL slug (e.g., "volt_prime_set")
 */
function toUrlName(name) {
  return name.toLowerCase().replace(/\s+/g, '_');
}

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const addItemForm = document.getElementById('add-item-form');
  const selectedItemName = document.getElementById('selected-item-name');
  const selectedItemUrl = document.getElementById('selected-item-url');
  const itemQuantity = document.getElementById('item-quantity');
  const minSellPrice = document.getElementById('min-sell-price');
  const maxBuyPrice = document.getElementById('max-buy-price');
  const autoListCheckbox = document.getElementById('auto-list-checkbox');
  const addItemBtn = document.getElementById('add-item-btn');
  const inventoryList = document.getElementById('inventory-list');
  const totalItemsSpan = document.getElementById('total-items');
  const autoSellCountSpan = document.getElementById('auto-sell-count');
  const autoBuyCountSpan = document.getElementById('auto-buy-count');
  const toggleBotBtn = document.getElementById('toggle-bot');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const qtyDecrease = document.getElementById('qty-decrease');
  const qtyIncrease = document.getElementById('qty-increase');
  const itemCardTemplate = document.getElementById('item-card-template');

  // Recommended Prices Elements
  const recommendedPrices = document.getElementById('recommended-prices');
  const recSellPrice = document.getElementById('rec-sell-price');
  const recBuyPrice = document.getElementById('rec-buy-price');
  const useRecommendedBtn = document.getElementById('use-recommended-btn');

  // Trades Tracker Elements
  const tradesRemaining = document.getElementById('trades-remaining');
  const masteryRank = document.getElementById('mastery-rank');

  // Capital Elements
  const platinumAmount = document.getElementById('platinum-amount');
  const creditsAmount = document.getElementById('credits-amount');

  // Confirm Modal Elements
  const confirmModal = document.getElementById('confirm-modal');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmItemUrl = document.getElementById('confirm-item-url');
  const closeConfirmModal = document.getElementById('close-confirm-modal');
  const cancelConfirm = document.getElementById('cancel-confirm');
  const confirmDelete = document.getElementById('confirm-delete');

  // Trade History Elements
  const tradeHistoryList = document.getElementById('trade-history-list');
  const todayTradesCount = document.getElementById('today-trades-count');
  const todayProfit = document.getElementById('today-profit');
  const recordSaleBtn = document.getElementById('record-sale-btn');
  const recordBuyBtn = document.getElementById('record-buy-btn');
  const tradeEntryTemplate = document.getElementById('trade-entry-template');

  // Record Trade Modal Elements
  const recordTradeModal = document.getElementById('record-trade-modal');
  const recordTradeTitle = document.getElementById('record-trade-title');
  const tradeType = document.getElementById('trade-type');
  const tradeItemSearch = document.getElementById('trade-item-search');
  const tradeItemResults = document.getElementById('trade-item-results');
  const tradeItemUrl = document.getElementById('trade-item-url');
  const tradeItemName = document.getElementById('trade-item-name');
  const tradeQuantity = document.getElementById('trade-quantity');
  const tradePrice = document.getElementById('trade-price');
  const tradePartner = document.getElementById('trade-partner');
  const closeRecordTradeModal = document.getElementById('close-record-trade-modal');
  const cancelRecordTrade = document.getElementById('cancel-record-trade');
  const submitRecordTrade = document.getElementById('submit-record-trade');

  // Trending Modal Elements
  const trendingModal = document.getElementById('trending-modal');
  const trendingItemName = document.getElementById('trending-item-name');
  const trendIcon = document.getElementById('trend-icon');
  const trendText = document.getElementById('trend-text');
  const trendChangeValue = document.getElementById('trend-change-value');
  const trendRecentAvg = document.getElementById('trend-recent-avg');
  const trendPreviousAvg = document.getElementById('trend-previous-avg');
  const trendVolume = document.getElementById('trend-volume');
  const trendHistoryBars = document.getElementById('trend-history-bars');
  const closeTrendingModal = document.getElementById('close-trending-modal');

  // History Tab Buttons
  const historyTabs = document.querySelectorAll('.history-tabs .tab-btn');

  let searchTimeout = null;
  let tradeSearchTimeout = null;
  let inventory = [];
  let currentRecommendedSell = null;
  let currentRecommendedBuy = null;
  let tradesUsedToday = 0;
  let currentHistoryTab = 'all';

  // Initialize
  loadInventory();
  checkBotStatus();
  setupConfirmModal();
  initTradesTracker();
  initCapitalTracker();
  initTradeHistory();
  setupRecordTradeModal();
  setupTrendingModal();
  setupHistoryTabs();
  initCapitalTracker();

  // Capital Tracker Functions
  async function initCapitalTracker() {
    // Load capital from file
    try {
      const capital = await window.api.capital.get();
      platinumAmount.value = capital.platinum || 0;
      creditsAmount.value = capital.credits || 0;
    } catch (error) {
      console.error('Error loading capital:', error);
      platinumAmount.value = 0;
      creditsAmount.value = 0;
    }
    
    // Listen for platinum changes
    platinumAmount.addEventListener('change', async () => {
      const value = Math.max(0, parseInt(platinumAmount.value) || 0);
      platinumAmount.value = value;
      try {
        await window.api.capital.setPlatinum(value);
      } catch (error) {
        console.error('Error saving platinum:', error);
      }
    });
    
    // Listen for credits changes
    creditsAmount.addEventListener('change', async () => {
      const value = Math.max(0, parseInt(creditsAmount.value) || 0);
      creditsAmount.value = value;
      try {
        await window.api.capital.setCredits(value);
      } catch (error) {
        console.error('Error saving credits:', error);
      }
    });
  }

  // Expose capital update functions for external use (e.g., after trades)
  window.updatePlatinum = async function(amount) {
    platinumAmount.value = amount;
    try {
      await window.api.capital.setPlatinum(amount);
    } catch (error) {
      console.error('Error updating platinum:', error);
    }
  };

  window.addPlatinum = async function(amount, reason = '') {
    try {
      const capital = await window.api.capital.addPlatinum(amount, reason);
      platinumAmount.value = capital.platinum;
    } catch (error) {
      console.error('Error adding platinum:', error);
    }
  };

  window.subtractPlatinum = async function(amount, reason = '') {
    try {
      const capital = await window.api.capital.subtractPlatinum(amount, reason);
      platinumAmount.value = capital.platinum;
    } catch (error) {
      console.error('Error subtracting platinum:', error);
    }
  };

  // Trades Tracker Functions
  function initTradesTracker() {
    // Load saved mastery rank from localStorage
    const savedMR = localStorage.getItem('masteryRank');
    if (savedMR) {
      masteryRank.value = savedMR;
    }
    
    // Load trades used today from localStorage
    const savedTrades = localStorage.getItem('tradesUsedToday');
    const savedDate = localStorage.getItem('tradesDate');
    const today = new Date().toDateString();
    
    if (savedDate === today && savedTrades) {
      tradesUsedToday = parseInt(savedTrades, 10);
    } else {
      // Reset if it's a new day
      tradesUsedToday = 0;
      localStorage.setItem('tradesDate', today);
      localStorage.setItem('tradesUsedToday', '0');
    }
    
    updateTradesDisplay();
    
    // Listen for mastery rank changes
    masteryRank.addEventListener('change', () => {
      let value = parseInt(masteryRank.value, 10) || 1;
      value = Math.max(1, Math.min(MAX_MASTERY_RANK, value));
      masteryRank.value = value;
      localStorage.setItem('masteryRank', value);
      updateTradesDisplay();
    });
  }

  function updateTradesDisplay() {
    const mr = parseInt(masteryRank.value, 10) || 17;
    const remaining = Math.max(0, mr - tradesUsedToday);
    tradesRemaining.textContent = remaining;
    
    // Change color based on remaining trades
    if (remaining <= 2) {
      tradesRemaining.style.color = 'var(--error)';
    } else if (remaining <= 5) {
      tradesRemaining.style.color = 'var(--warning)';
    } else {
      tradesRemaining.style.color = 'var(--accent-primary)';
    }
  }

  // Expose useTrade for external calls when trades are completed
  window.useTrade = function() {
    tradesUsedToday++;
    localStorage.setItem('tradesUsedToday', tradesUsedToday.toString());
    updateTradesDisplay();
  };

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
      searchResults.classList.add('hidden');
      addItemForm.classList.add('hidden');
      return;
    }

    searchTimeout = setTimeout(async () => {
      const results = await window.api.market.search(query);
      displaySearchResults(results);
    }, 300);
  });

  function displaySearchResults(results) {
    searchResults.innerHTML = '';
    
    // Handle error response
    if (results && results.error) {
      searchResults.innerHTML = `<div class="search-result-item error">${results.error}</div>`;
      searchResults.classList.remove('hidden');
      return;
    }
    
    // Handle empty results or non-array
    if (!Array.isArray(results) || results.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item">No items found. Try a different search term.</div>';
      searchResults.classList.remove('hidden');
      return;
    }

    results.forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = item.item_name || item.url_name.replace(/_/g, ' ');
      div.dataset.urlName = item.url_name;
      div.dataset.itemName = item.item_name || item.url_name.replace(/_/g, ' ');
      
      div.addEventListener('click', () => selectItem(item));
      searchResults.appendChild(div);
    });

    searchResults.classList.remove('hidden');
  }

  async function selectItem(item) {
    selectedItemName.textContent = item.item_name || item.url_name.replace(/_/g, ' ');
    selectedItemUrl.value = item.url_name;
    itemQuantity.value = 1;
    minSellPrice.value = '';
    maxBuyPrice.value = '';
    autoListCheckbox.checked = true;
    
    // Reset recommended prices
    currentRecommendedSell = null;
    currentRecommendedBuy = null;
    recSellPrice.textContent = 'Loading...';
    recBuyPrice.textContent = 'Loading...';
    recommendedPrices.classList.remove('hidden');
    
    searchResults.classList.add('hidden');
    addItemForm.classList.remove('hidden');
    searchInput.value = '';

    // Auto-analyze the item for recommended prices
    try {
      const analysis = await window.api.market.analyze(item.url_name);
      if (analysis) {
        currentRecommendedSell = analysis.optimalSellPrice || analysis.lowestSell;
        currentRecommendedBuy = analysis.optimalBuyPrice || analysis.highestBuy;
        
        recSellPrice.textContent = currentRecommendedSell ? `${currentRecommendedSell}p` : '—';
        recBuyPrice.textContent = currentRecommendedBuy ? `${currentRecommendedBuy}p` : '—';
        
        // Auto-fill with recommended prices if auto-list is checked
        if (autoListCheckbox.checked && currentRecommendedSell) {
          minSellPrice.value = currentRecommendedSell;
        }
      } else {
        recSellPrice.textContent = '—';
        recBuyPrice.textContent = '—';
      }
    } catch (error) {
      console.error('Error analyzing item:', error);
      recSellPrice.textContent = 'Error';
      recBuyPrice.textContent = 'Error';
    }
  }

  // Use Recommended Prices button
  useRecommendedBtn.addEventListener('click', () => {
    if (currentRecommendedSell) {
      minSellPrice.value = currentRecommendedSell;
    }
    if (currentRecommendedBuy) {
      maxBuyPrice.value = currentRecommendedBuy;
    }
  });

  // Quantity controls for add form
  qtyDecrease.addEventListener('click', () => {
    const current = parseInt(itemQuantity.value) || 1;
    if (current > 1) {
      itemQuantity.value = current - 1;
    }
  });

  qtyIncrease.addEventListener('click', () => {
    const current = parseInt(itemQuantity.value) || 1;
    if (current < 100) {
      itemQuantity.value = current + 1;
    }
  });

  // Add item button
  addItemBtn.addEventListener('click', async () => {
    const urlName = selectedItemUrl.value;
    if (!urlName) return;

    const itemData = {
      urlName,
      itemName: selectedItemName.textContent,
      quantity: parseInt(itemQuantity.value) || 1,
      minSellPrice: minSellPrice.value ? parseInt(minSellPrice.value) : null,
      maxBuyPrice: maxBuyPrice.value ? parseInt(maxBuyPrice.value) : null,
      autoList: autoListCheckbox.checked
    };

    await window.api.inventory.add(itemData);
    addItemForm.classList.add('hidden');
    loadInventory();
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.classList.add('hidden');
    }
  });

  // Load inventory
  async function loadInventory() {
    inventory = await window.api.inventory.getAll();
    renderInventory();
    updateStats();
  }

  function renderInventory() {
    inventoryList.innerHTML = '';

    if (inventory.length === 0) {
      inventoryList.innerHTML = `
        <div class="empty-state">
          <p>No items in inventory</p>
          <p class="hint">Search and add items using the panel on the left</p>
        </div>
      `;
      return;
    }

    inventory.forEach(item => {
      const card = createItemCard(item);
      inventoryList.appendChild(card);
    });
  }

  function createItemCard(item) {
    const template = itemCardTemplate.content.cloneNode(true);
    const card = template.querySelector('.item-card');
    
    card.dataset.urlName = item.urlName;
    // Consider disabled if neither autoSell nor autoBuy is enabled
    const isDisabled = !item.autoSell && !item.autoBuy;
    if (isDisabled) {
      card.classList.add('disabled');
    }

    card.querySelector('.item-name').textContent = item.itemName;
    
    const qtyInput = card.querySelector('.item-quantity');
    qtyInput.value = item.quantity;
    
    const minSellInput = card.querySelector('.min-sell');
    if (item.minSellPrice) {
      minSellInput.value = item.minSellPrice;
    }
    
    const maxBuyInput = card.querySelector('.max-buy');
    if (item.maxBuyPrice) {
      maxBuyInput.value = item.maxBuyPrice;
    }
    
    // Separate auto-sell and auto-buy toggles
    const autoSellToggle = card.querySelector('.auto-sell-toggle');
    const autoBuyToggle = card.querySelector('.auto-buy-toggle');
    autoSellToggle.checked = item.autoSell !== false; // Default to true for backwards compatibility
    autoBuyToggle.checked = item.autoBuy || false;

    // Event listeners
    const qtyDec = card.querySelector('.qty-dec');
    const qtyInc = card.querySelector('.qty-inc');
    
    qtyDec.addEventListener('click', async () => {
      const current = parseInt(qtyInput.value) || 1;
      if (current > 1) {
        qtyInput.value = current - 1;
        await window.api.inventory.updateQuantity(item.urlName, current - 1);
        updateStats();
      }
    });

    qtyInc.addEventListener('click', async () => {
      const current = parseInt(qtyInput.value) || 1;
      if (current < 100) {
        qtyInput.value = current + 1;
        await window.api.inventory.updateQuantity(item.urlName, current + 1);
        updateStats();
      }
    });

    qtyInput.addEventListener('change', async () => {
      let value = parseInt(qtyInput.value) || 1;
      value = Math.max(1, Math.min(100, value));
      qtyInput.value = value;
      await window.api.inventory.updateQuantity(item.urlName, value);
      updateStats();
    });

    minSellInput.addEventListener('change', async () => {
      const minSell = minSellInput.value ? parseInt(minSellInput.value) : null;
      const maxBuy = maxBuyInput.value ? parseInt(maxBuyInput.value) : null;
      await window.api.inventory.setPriceConstraints(item.urlName, minSell, maxBuy);
    });

    maxBuyInput.addEventListener('change', async () => {
      const minSell = minSellInput.value ? parseInt(minSellInput.value) : null;
      const maxBuy = maxBuyInput.value ? parseInt(maxBuyInput.value) : null;
      await window.api.inventory.setPriceConstraints(item.urlName, minSell, maxBuy);
    });

    // Auto-sell toggle
    autoSellToggle.addEventListener('change', async () => {
      await window.api.inventory.toggleAutoSell(item.urlName);
      const nowDisabled = !autoSellToggle.checked && !autoBuyToggle.checked;
      card.classList.toggle('disabled', nowDisabled);
      updateStats();
    });

    // Auto-buy toggle
    autoBuyToggle.addEventListener('change', async () => {
      await window.api.inventory.toggleAutoBuy(item.urlName);
      const nowDisabled = !autoSellToggle.checked && !autoBuyToggle.checked;
      card.classList.toggle('disabled', nowDisabled);
      updateStats();
    });

    // Trending button
    const trendingBtn = card.querySelector('.btn-trending');
    trendingBtn.addEventListener('click', async () => {
      showTrendingModal(item.urlName, item.itemName);
    });

    const analyzeBtn = card.querySelector('.btn-analyze');
    analyzeBtn.addEventListener('click', async () => {
      analyzeBtn.textContent = '⏳';
      const analysis = await window.api.market.analyze(item.urlName);
      analyzeBtn.textContent = '📊';
      if (analysis) {
        const pricesDiv = card.querySelector('.item-prices');
        pricesDiv.querySelector('.lowest-sell').textContent = analysis.lowestSell ? `${analysis.lowestSell}p` : '—';
        pricesDiv.querySelector('.highest-buy').textContent = analysis.highestBuy ? `${analysis.highestBuy}p` : '—';
        pricesDiv.querySelector('.rec-sell').textContent = analysis.optimalSellPrice ? `${analysis.optimalSellPrice}p` : '—';
        pricesDiv.classList.remove('hidden');
        
        // Store for apply button
        card.dataset.recSell = analysis.optimalSellPrice || '';
        card.dataset.recBuy = analysis.optimalBuyPrice || '';
      }
    });

    // Apply recommended prices button
    const applyRecBtn = card.querySelector('.btn-apply-rec');
    applyRecBtn.addEventListener('click', async () => {
      // First analyze if not already done
      applyRecBtn.textContent = '⏳';
      const analysis = await window.api.market.analyze(item.urlName);
      applyRecBtn.textContent = '🎯';
      
      if (analysis) {
        const recSell = analysis.optimalSellPrice || analysis.lowestSell;
        const recBuy = analysis.optimalBuyPrice || analysis.highestBuy;
        
        if (recSell) {
          minSellInput.value = recSell;
        }
        if (recBuy) {
          maxBuyInput.value = recBuy;
        }
        
        // Save the constraints
        await window.api.inventory.setPriceConstraints(item.urlName, recSell, recBuy);
        
        // Show the prices
        const pricesDiv = card.querySelector('.item-prices');
        pricesDiv.querySelector('.lowest-sell').textContent = analysis.lowestSell ? `${analysis.lowestSell}p` : '—';
        pricesDiv.querySelector('.highest-buy').textContent = analysis.highestBuy ? `${analysis.highestBuy}p` : '—';
        pricesDiv.querySelector('.rec-sell').textContent = recSell ? `${recSell}p` : '—';
        pricesDiv.classList.remove('hidden');
      }
    });

    const removeBtn = card.querySelector('.btn-remove');
    removeBtn.addEventListener('click', () => {
      showConfirmModal(item.urlName, item.itemName);
    });

    return card;
  }

  // Confirm Modal Functions
  function setupConfirmModal() {
    closeConfirmModal.addEventListener('click', hideConfirmModal);
    cancelConfirm.addEventListener('click', hideConfirmModal);
    confirmDelete.addEventListener('click', async () => {
      const urlName = confirmItemUrl.value;
      if (urlName) {
        await window.api.inventory.remove(urlName);
        loadInventory();
        hideConfirmModal();
      }
    });
    
    // Close on outside click
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        hideConfirmModal();
      }
    });
  }

  function showConfirmModal(urlName, itemName) {
    confirmItemUrl.value = urlName;
    confirmMessage.textContent = `Are you sure you want to remove "${itemName}" from your inventory?`;
    confirmModal.classList.remove('hidden');
  }

  function hideConfirmModal() {
    confirmModal.classList.add('hidden');
  }

  function updateStats() {
    totalItemsSpan.textContent = `${inventory.length} items`;
    const autoSellCount = inventory.filter(i => i.autoSell !== false).length;
    const autoBuyCount = inventory.filter(i => i.autoBuy).length;
    autoSellCountSpan.textContent = `${autoSellCount} auto-sell`;
    autoBuyCountSpan.textContent = `${autoBuyCount} auto-buy`;
  }

  // Trade History Functions
  async function initTradeHistory() {
    await loadTradeHistory();
    await updateTodayStats();
  }

  async function loadTradeHistory(filter = 'all') {
    let trades;
    if (filter === 'sales') {
      trades = await window.api.tradeHistory.getSales(50);
    } else if (filter === 'purchases') {
      trades = await window.api.tradeHistory.getPurchases(50);
    } else {
      trades = await window.api.tradeHistory.getAll(50);
    }
    
    renderTradeHistory(trades);
  }

  function renderTradeHistory(trades) {
    tradeHistoryList.innerHTML = '';
    
    if (!trades || trades.length === 0) {
      tradeHistoryList.innerHTML = `
        <div class="empty-state small">
          <p>No trades yet</p>
        </div>
      `;
      return;
    }

    trades.forEach(trade => {
      const entry = createTradeEntry(trade);
      tradeHistoryList.appendChild(entry);
    });
  }

  function createTradeEntry(trade) {
    const div = document.createElement('div');
    div.className = `trade-entry ${trade.type}`;
    div.dataset.tradeId = trade.id;
    
    const icon = trade.type === 'sell' ? '💰' : '💵';
    const timeAgo = getTimeAgo(new Date(trade.timestamp));
    
    div.innerHTML = `
      <div class="trade-icon">${icon}</div>
      <div class="trade-details">
        <span class="trade-item-name">${trade.itemName}</span>
        <span class="trade-meta">${trade.quantity}x @ ${trade.price}p • ${timeAgo}</span>
      </div>
      <div class="trade-value ${trade.type}">${trade.type === 'sell' ? '+' : '-'}${trade.totalValue}p</div>
    `;
    
    return div;
  }

  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function updateTodayStats() {
    const stats = await window.api.tradeHistory.getTodayStats();
    todayTradesCount.textContent = stats.totalTrades;
    const profit = stats.profit;
    todayProfit.textContent = profit >= 0 ? `+${profit}p` : `${profit}p`;
    todayProfit.className = profit >= 0 ? 'stat-value profit' : 'stat-value loss';
  }

  function setupHistoryTabs() {
    historyTabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        historyTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentHistoryTab = tab.dataset.tab;
        await loadTradeHistory(currentHistoryTab);
      });
    });
  }

  // Record Trade Modal
  function setupRecordTradeModal() {
    recordSaleBtn.addEventListener('click', () => {
      openRecordTradeModal('sell');
    });

    recordBuyBtn.addEventListener('click', () => {
      openRecordTradeModal('buy');
    });

    closeRecordTradeModal.addEventListener('click', hideRecordTradeModal);
    cancelRecordTrade.addEventListener('click', hideRecordTradeModal);

    recordTradeModal.addEventListener('click', (e) => {
      if (e.target === recordTradeModal) {
        hideRecordTradeModal();
      }
    });

    // Trade item search
    tradeItemSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (tradeSearchTimeout) {
        clearTimeout(tradeSearchTimeout);
      }

      if (query.length < 2) {
        tradeItemResults.classList.add('hidden');
        return;
      }

      tradeSearchTimeout = setTimeout(async () => {
        const results = await window.api.market.search(query);
        displayTradeSearchResults(results);
      }, 300);
    });

    submitRecordTrade.addEventListener('click', async () => {
      const itemName = tradeItemName.value || tradeItemSearch.value;
      const urlName = tradeItemUrl.value || toUrlName(tradeItemSearch.value);
      const quantity = parseInt(tradeQuantity.value) || 1;
      const price = parseInt(tradePrice.value);
      const partner = tradePartner.value || null;

      if (!itemName || !price) {
        alert('Please enter an item name and price');
        return;
      }

      if (tradeType.value === 'sell') {
        await window.api.tradeHistory.recordSale(itemName, urlName, quantity, price, partner);
        // Update platinum
        await window.addPlatinum(price * quantity, `Sold ${quantity}x ${itemName}`);
        // Use a trade
        window.useTrade();
      } else {
        await window.api.tradeHistory.recordPurchase(itemName, urlName, quantity, price, partner);
        // Subtract platinum
        await window.subtractPlatinum(price * quantity, `Bought ${quantity}x ${itemName}`);
        // Use a trade
        window.useTrade();
      }

      hideRecordTradeModal();
      await loadTradeHistory(currentHistoryTab);
      await updateTodayStats();
    });
  }

  function displayTradeSearchResults(results) {
    tradeItemResults.innerHTML = '';
    
    if (results && results.error) {
      tradeItemResults.innerHTML = `<div class="search-result-item error">${results.error}</div>`;
      tradeItemResults.classList.remove('hidden');
      return;
    }
    
    if (!Array.isArray(results) || results.length === 0) {
      tradeItemResults.innerHTML = '<div class="search-result-item">No items found</div>';
      tradeItemResults.classList.remove('hidden');
      return;
    }

    results.slice(0, 10).forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = item.item_name || item.url_name.replace(/_/g, ' ');
      
      div.addEventListener('click', () => {
        tradeItemSearch.value = item.item_name || item.url_name.replace(/_/g, ' ');
        tradeItemUrl.value = item.url_name;
        tradeItemName.value = item.item_name || item.url_name.replace(/_/g, ' ');
        tradeItemResults.classList.add('hidden');
      });
      
      tradeItemResults.appendChild(div);
    });

    tradeItemResults.classList.remove('hidden');
  }

  function openRecordTradeModal(type) {
    tradeType.value = type;
    recordTradeTitle.textContent = type === 'sell' ? '💰 Record Sale' : '💵 Record Purchase';
    submitRecordTrade.textContent = type === 'sell' ? 'Record Sale' : 'Record Purchase';
    submitRecordTrade.className = type === 'sell' ? 'btn btn-success' : 'btn btn-warning';
    
    // Reset form
    tradeItemSearch.value = '';
    tradeItemUrl.value = '';
    tradeItemName.value = '';
    tradeQuantity.value = 1;
    tradePrice.value = '';
    tradePartner.value = '';
    tradeItemResults.classList.add('hidden');
    
    recordTradeModal.classList.remove('hidden');
  }

  function hideRecordTradeModal() {
    recordTradeModal.classList.add('hidden');
  }

  // Trending Modal Functions
  function setupTrendingModal() {
    closeTrendingModal.addEventListener('click', hideTrendingModal);
    trendingModal.addEventListener('click', (e) => {
      if (e.target === trendingModal) {
        hideTrendingModal();
      }
    });
  }

  async function showTrendingModal(urlName, itemName) {
    trendingItemName.textContent = itemName;
    trendIcon.textContent = '⏳';
    trendText.textContent = 'Loading...';
    trendChangeValue.textContent = '';
    trendRecentAvg.textContent = '—';
    trendPreviousAvg.textContent = '—';
    trendVolume.textContent = '—';
    trendHistoryBars.innerHTML = '';
    
    trendingModal.classList.remove('hidden');
    
    const trending = await window.api.market.getTrending(urlName);
    
    if (trending.error) {
      trendIcon.textContent = '❌';
      trendText.textContent = 'Error loading data';
      return;
    }
    
    // Update trend display
    const trendIcons = {
      'rising': '📈',
      'slight_rise': '↗️',
      'stable': '➡️',
      'slight_fall': '↘️',
      'falling': '📉'
    };
    
    const trendColors = {
      'rising': 'var(--success)',
      'slight_rise': '#8bc34a',
      'stable': 'var(--text-secondary)',
      'slight_fall': 'var(--warning)',
      'falling': 'var(--error)'
    };
    
    trendIcon.textContent = trendIcons[trending.trend] || '➡️';
    trendText.textContent = trending.trend.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    trendText.style.color = trendColors[trending.trend];
    
    const changePrefix = trending.change >= 0 ? '+' : '';
    trendChangeValue.textContent = `${changePrefix}${trending.change}%`;
    trendChangeValue.style.color = trending.change >= 0 ? 'var(--success)' : 'var(--error)';
    
    trendRecentAvg.textContent = trending.recentAvg ? `${trending.recentAvg}p` : '—';
    trendPreviousAvg.textContent = trending.previousAvg ? `${trending.previousAvg}p` : '—';
    trendVolume.textContent = trending.volume || '—';
    
    // Render price history bars
    if (trending.history && trending.history.length > 0) {
      const maxPrice = Math.max(...trending.history.map(d => d.price));
      trendHistoryBars.innerHTML = trending.history.map(d => {
        const height = maxPrice > 0 ? (d.price / maxPrice) * 100 : 0;
        const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        return `
          <div class="history-bar" title="${date}: ${d.price}p">
            <div class="bar-fill" style="height: ${height}%"></div>
            <span class="bar-label">${d.price}p</span>
          </div>
        `;
      }).join('');
    }
  }

  function hideTrendingModal() {
    trendingModal.classList.add('hidden');
  }

  // Bot control
  toggleBotBtn.addEventListener('click', async () => {
    const status = await window.api.bot.status();
    
    if (status.running) {
      await window.api.bot.stop();
    } else {
      await window.api.bot.start();
    }
    
    checkBotStatus();
  });

  async function checkBotStatus() {
    const status = await window.api.bot.status();
    
    if (status.running) {
      statusIndicator.classList.remove('offline');
      statusIndicator.classList.add('online');
      statusText.textContent = 'Running';
      toggleBotBtn.textContent = 'Stop Bot';
      toggleBotBtn.classList.remove('btn-primary');
      toggleBotBtn.classList.add('btn-danger');
    } else {
      statusIndicator.classList.remove('online');
      statusIndicator.classList.add('offline');
      statusText.textContent = 'Stopped';
      toggleBotBtn.textContent = 'Start Bot';
      toggleBotBtn.classList.remove('btn-danger');
      toggleBotBtn.classList.add('btn-primary');
    }
  }
});
