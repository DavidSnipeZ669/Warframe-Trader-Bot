// Warframe Trader Bot - Renderer Script

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

  let searchTimeout = null;
  let inventory = [];

  // Initialize
  loadInventory();
  checkBotStatus();

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

  function selectItem(item) {
    selectedItemName.textContent = item.item_name || item.url_name.replace(/_/g, ' ');
    selectedItemUrl.value = item.url_name;
    itemQuantity.value = 1;
    minSellPrice.value = '';
    maxBuyPrice.value = '';
    autoListCheckbox.checked = true;
    
    searchResults.classList.add('hidden');
    addItemForm.classList.remove('hidden');
    searchInput.value = '';
  }

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
      const analysis = await window.api.market.analyze(item.urlName);
      if (analysis) {
        const pricesDiv = card.querySelector('.item-prices');
        pricesDiv.querySelector('.lowest-sell').textContent = analysis.lowestSell ? `${analysis.lowestSell}p` : '—';
        pricesDiv.querySelector('.highest-buy').textContent = analysis.highestBuy ? `${analysis.highestBuy}p` : '—';
        pricesDiv.classList.remove('hidden');
      }
    });

    const removeBtn = card.querySelector('.btn-remove');
    removeBtn.addEventListener('click', async () => {
      await window.api.inventory.remove(item.urlName);
      loadInventory();
    });

    return card;
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
