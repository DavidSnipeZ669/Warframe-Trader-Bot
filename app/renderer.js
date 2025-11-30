// Warframe Trader Bot - Renderer Script

// Constants
const MAX_MASTERY_RANK = 35;

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
  const autoListedSpan = document.getElementById('auto-listed');
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

  // Confirm Modal Elements
  const confirmModal = document.getElementById('confirm-modal');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmItemUrl = document.getElementById('confirm-item-url');
  const closeConfirmModal = document.getElementById('close-confirm-modal');
  const cancelConfirm = document.getElementById('cancel-confirm');
  const confirmDelete = document.getElementById('confirm-delete');

  let searchTimeout = null;
  let inventory = [];
  let currentRecommendedSell = null;
  let currentRecommendedBuy = null;
  let tradesUsedToday = 0;

  // Initialize
  loadInventory();
  checkBotStatus();
  setupConfirmModal();
  initTradesTracker();

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
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item">No items found</div>';
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
    if (!item.autoList) {
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
    
    const autoListToggle = card.querySelector('.auto-list-toggle');
    autoListToggle.checked = item.autoList;

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

    autoListToggle.addEventListener('change', async () => {
      await window.api.inventory.toggleAutoList(item.urlName);
      card.classList.toggle('disabled', !autoListToggle.checked);
      updateStats();
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
    const autoListed = inventory.filter(i => i.autoList).length;
    autoListedSpan.textContent = `${autoListed} auto-listed`;
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
