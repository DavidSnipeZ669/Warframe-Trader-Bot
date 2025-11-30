const fs = require('fs');
const path = require('path');

// Mock the electron module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-data')
  }
}), { virtual: true });

describe('Capital Service', () => {
  let capitalService;
  const mockCapitalData = {
    platinum: 1000,
    credits: 500000,
    updatedAt: '2024-01-01T00:00:00.000Z',
    history: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset module cache to get fresh instance
    jest.resetModules();
    
    // Import fresh instance (will create file in data directory)
    capitalService = require('../src/services/capital');
  });

  afterEach(() => {
    // Clean up
    jest.resetModules();
  });

  describe('getCapital', () => {
    it('should return current platinum and credits', () => {
      const capital = capitalService.getCapital();
      expect(capital).toHaveProperty('platinum');
      expect(capital).toHaveProperty('credits');
      expect(capital).toHaveProperty('updatedAt');
    });
  });

  describe('setPlatinum', () => {
    it('should set platinum amount', () => {
      const result = capitalService.setPlatinum(2000);
      expect(result.platinum).toBe(2000);
    });

    it('should not allow negative platinum', () => {
      const result = capitalService.setPlatinum(-100);
      expect(result.platinum).toBe(0);
    });

    it('should floor decimal values', () => {
      const result = capitalService.setPlatinum(100.7);
      expect(result.platinum).toBe(100);
    });
  });

  describe('setCredits', () => {
    it('should set credits amount', () => {
      const result = capitalService.setCredits(1000000);
      expect(result.credits).toBe(1000000);
    });

    it('should not allow negative credits', () => {
      const result = capitalService.setCredits(-100);
      expect(result.credits).toBe(0);
    });
  });

  describe('addPlatinum', () => {
    it('should add platinum with reason', () => {
      capitalService.setPlatinum(0);
      const result = capitalService.addPlatinum(500, 'Sold Volt Prime Set');
      expect(result.platinum).toBe(500);
    });

    it('should accumulate platinum', () => {
      capitalService.setPlatinum(100);
      const result = capitalService.addPlatinum(50, 'Another sale');
      expect(result.platinum).toBe(150);
    });
  });

  describe('subtractPlatinum', () => {
    it('should subtract platinum', () => {
      capitalService.setPlatinum(1000);
      const result = capitalService.subtractPlatinum(200, 'Bought item');
      expect(result.platinum).toBe(800);
    });

    it('should not go below zero', () => {
      capitalService.setPlatinum(100);
      const result = capitalService.subtractPlatinum(500, 'Bought expensive item');
      expect(result.platinum).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('should return history array', () => {
      const history = capitalService.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should track changes in history', () => {
      capitalService.setPlatinum(0);
      capitalService.addPlatinum(100, 'test1');
      capitalService.addPlatinum(200, 'test2');
      
      const history = capitalService.getHistory(10);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('type');
      expect(history[0]).toHaveProperty('change');
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('should respect limit parameter', () => {
      capitalService.setPlatinum(0);
      capitalService.addPlatinum(100, 'test1');
      capitalService.addPlatinum(200, 'test2');
      capitalService.addPlatinum(300, 'test3');
      
      const history = capitalService.getHistory(2);
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset capital to zero', () => {
      capitalService.setPlatinum(5000);
      capitalService.setCredits(1000000);
      
      const result = capitalService.reset();
      expect(result.platinum).toBe(0);
      expect(result.credits).toBe(0);
    });
  });
});
