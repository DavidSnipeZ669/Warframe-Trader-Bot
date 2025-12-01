const path = require('path');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('TradeHistoryService', () => {
  let tradeHistoryService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock fs functions
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    
    // Reset the module cache to get a fresh instance
    jest.resetModules();
    
    // Re-require the service
    tradeHistoryService = require('../src/services/tradeHistory');
  });

  describe('recordSale', () => {
    it('should record a sale correctly', () => {
      const sale = tradeHistoryService.recordSale('Volt Prime Set', 'volt_prime_set', 1, 200, 'buyer123');
      
      expect(sale).toBeDefined();
      expect(sale.type).toBe('sell');
      expect(sale.itemName).toBe('Volt Prime Set');
      expect(sale.urlName).toBe('volt_prime_set');
      expect(sale.quantity).toBe(1);
      expect(sale.price).toBe(200);
      expect(sale.totalValue).toBe(200);
      expect(sale.buyer).toBe('buyer123');
    });

    it('should calculate totalValue correctly for multiple quantity', () => {
      const sale = tradeHistoryService.recordSale('Volt Prime Set', 'volt_prime_set', 3, 200);
      
      expect(sale.quantity).toBe(3);
      expect(sale.totalValue).toBe(600);
    });
  });

  describe('recordPurchase', () => {
    it('should record a purchase correctly', () => {
      const purchase = tradeHistoryService.recordPurchase('Rhino Prime Blueprint', 'rhino_prime_blueprint', 2, 50, 'seller456');
      
      expect(purchase).toBeDefined();
      expect(purchase.type).toBe('buy');
      expect(purchase.itemName).toBe('Rhino Prime Blueprint');
      expect(purchase.urlName).toBe('rhino_prime_blueprint');
      expect(purchase.quantity).toBe(2);
      expect(purchase.price).toBe(50);
      expect(purchase.totalValue).toBe(100);
      expect(purchase.seller).toBe('seller456');
    });
  });

  describe('getHistory', () => {
    it('should return trade history with limit', () => {
      // Add some trades
      tradeHistoryService.recordSale('Item 1', 'item_1', 1, 100);
      tradeHistoryService.recordPurchase('Item 2', 'item_2', 1, 50);
      tradeHistoryService.recordSale('Item 3', 'item_3', 1, 75);
      
      const history = tradeHistoryService.getHistory(2);
      
      expect(history).toHaveLength(2);
    });

    it('should return all history when no limit', () => {
      tradeHistoryService.recordSale('Item 1', 'item_1', 1, 100);
      tradeHistoryService.recordPurchase('Item 2', 'item_2', 1, 50);
      
      const history = tradeHistoryService.getHistory();
      
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getSales', () => {
    it('should return only sales', () => {
      tradeHistoryService.recordSale('Item 1', 'item_1', 1, 100);
      tradeHistoryService.recordPurchase('Item 2', 'item_2', 1, 50);
      tradeHistoryService.recordSale('Item 3', 'item_3', 1, 75);
      
      const sales = tradeHistoryService.getSales();
      
      expect(sales.every(t => t.type === 'sell')).toBe(true);
    });
  });

  describe('getPurchases', () => {
    it('should return only purchases', () => {
      tradeHistoryService.recordSale('Item 1', 'item_1', 1, 100);
      tradeHistoryService.recordPurchase('Item 2', 'item_2', 1, 50);
      tradeHistoryService.recordPurchase('Item 3', 'item_3', 1, 75);
      
      const purchases = tradeHistoryService.getPurchases();
      
      expect(purchases.every(t => t.type === 'buy')).toBe(true);
    });
  });

  describe('getItemHistory', () => {
    it('should return history for specific item', () => {
      tradeHistoryService.recordSale('Volt Prime Set', 'volt_prime_set', 1, 100);
      tradeHistoryService.recordPurchase('Other Item', 'other_item', 1, 50);
      tradeHistoryService.recordSale('Volt Prime Set', 'volt_prime_set', 1, 110);
      
      const itemHistory = tradeHistoryService.getItemHistory('volt_prime_set');
      
      expect(itemHistory.every(t => t.urlName === 'volt_prime_set')).toBe(true);
    });
  });

  describe('getTodayStats', () => {
    it('should calculate today stats correctly', () => {
      tradeHistoryService.recordSale('Item 1', 'item_1', 1, 100);
      tradeHistoryService.recordPurchase('Item 2', 'item_2', 1, 50);
      
      const stats = tradeHistoryService.getTodayStats();
      
      expect(stats.salesCount).toBeGreaterThanOrEqual(1);
      expect(stats.purchasesCount).toBeGreaterThanOrEqual(1);
      expect(stats.totalSalesValue).toBeGreaterThanOrEqual(100);
      expect(stats.totalPurchasesValue).toBeGreaterThanOrEqual(50);
    });
  });

  describe('deleteTrade', () => {
    it('should delete a specific trade', () => {
      const trade = tradeHistoryService.recordSale('Item 1', 'item_1', 1, 100);
      const initialLength = tradeHistoryService.getHistory().length;
      
      const result = tradeHistoryService.deleteTrade(trade.id);
      
      expect(result).toBe(true);
      expect(tradeHistoryService.getHistory().length).toBe(initialLength - 1);
    });

    it('should return false for non-existent trade', () => {
      const result = tradeHistoryService.deleteTrade('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
