// Mock the logger first before importing inventory
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock the file system for testing - keep actual fs functions for Winston
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
  };
});

const fs = require('fs');

// Reset modules before each test
beforeEach(() => {
  jest.resetModules();
  fs.existsSync.mockReturnValue(false);
  fs.readFileSync.mockReturnValue('[]');
  fs.writeFileSync.mockImplementation(() => {});
  fs.mkdirSync.mockImplementation(() => {});
});

describe('InventoryService', () => {
  let inventoryService;

  beforeEach(() => {
    // Import fresh instance
    inventoryService = require('../src/services/inventory');
    // Reset inventory
    inventoryService.inventory = [];
  });

  test('should add item to inventory', () => {
    const item = inventoryService.addItem({
      urlName: 'volt_prime_set',
      quantity: 2,
      minSellPrice: 100,
      maxBuyPrice: 80
    });

    expect(item.urlName).toBe('volt_prime_set');
    expect(item.quantity).toBe(2);
    expect(item.minSellPrice).toBe(100);
    expect(item.maxBuyPrice).toBe(80);
    expect(item.autoList).toBe(true);
  });

  test('should get all items', () => {
    inventoryService.addItem({ urlName: 'item1' });
    inventoryService.addItem({ urlName: 'item2' });

    const items = inventoryService.getAllItems();
    expect(items.length).toBe(2);
  });

  test('should get specific item', () => {
    inventoryService.addItem({ urlName: 'test_item', quantity: 5 });

    const item = inventoryService.getItem('test_item');
    expect(item).not.toBeNull();
    expect(item.urlName).toBe('test_item');
    expect(item.quantity).toBe(5);
  });

  test('should return null for non-existent item', () => {
    const item = inventoryService.getItem('non_existent');
    expect(item).toBeNull();
  });

  test('should remove item from inventory', () => {
    inventoryService.addItem({ urlName: 'to_remove' });
    expect(inventoryService.getAllItems().length).toBe(1);

    const removed = inventoryService.removeItem('to_remove');
    expect(removed).toBe(true);
    expect(inventoryService.getAllItems().length).toBe(0);
  });

  test('should return false when removing non-existent item', () => {
    const removed = inventoryService.removeItem('non_existent');
    expect(removed).toBe(false);
  });

  test('should update item quantity', () => {
    inventoryService.addItem({ urlName: 'test_item', quantity: 1 });
    
    const updated = inventoryService.updateQuantity('test_item', 10);
    expect(updated.quantity).toBe(10);
  });

  test('should get auto-list items', () => {
    inventoryService.addItem({ urlName: 'auto_item', autoList: true });
    inventoryService.addItem({ urlName: 'manual_item', autoList: false });

    const autoItems = inventoryService.getAutoListItems();
    expect(autoItems.length).toBe(1);
    expect(autoItems[0].urlName).toBe('auto_item');
  });

  test('should set price constraints', () => {
    inventoryService.addItem({ urlName: 'priced_item' });
    
    const updated = inventoryService.setPriceConstraints('priced_item', 150, 100);
    expect(updated.minSellPrice).toBe(150);
    expect(updated.maxBuyPrice).toBe(100);
  });

  test('should update existing item instead of duplicating', () => {
    inventoryService.addItem({ urlName: 'same_item', quantity: 1 });
    inventoryService.addItem({ urlName: 'same_item', quantity: 5 });

    const items = inventoryService.getAllItems();
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(5);
  });

  test('should convert item name from URL format', () => {
    const item = inventoryService.addItem({ urlName: 'volt_prime_set' });
    expect(item.itemName).toBe('volt prime set');
  });
});
