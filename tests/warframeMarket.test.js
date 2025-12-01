// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: {
        use: jest.fn()
      }
    }
  }))
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('WarframeMarketAPI v2', () => {
  let warframeMarket;
  let mockClient;

  beforeEach(() => {
    jest.resetModules();
    
    const axios = require('axios');
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        response: {
          use: jest.fn()
        }
      }
    };
    axios.create.mockReturnValue(mockClient);
    
    warframeMarket = require('../src/api/warframeMarket');
  });

  test('should get API versions', async () => {
    const mockVersions = {
      apps: { ios: '1.0.0', android: '1.0.0' },
      collections: { items: 'abc123' }
    };

    mockClient.get.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockVersions, error: null }
    });

    const versions = await warframeMarket.getVersions();
    expect(versions).toEqual(mockVersions);
    expect(mockClient.get).toHaveBeenCalledWith('/versions');
  });

  test('should get all items with v2 response format', async () => {
    const mockItems = [
      { itemName: 'Volt Prime Set', slug: 'volt_prime_set' },
      { itemName: 'Rhino Prime Set', slug: 'rhino_prime_set' }
    ];

    mockClient.get.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockItems, error: null }
    });

    const items = await warframeMarket.getAllItems();
    expect(items).toEqual(mockItems);
    expect(mockClient.get).toHaveBeenCalledWith('/items');
  });

  test('should get item info with v2 endpoint', async () => {
    const mockItem = {
      id: '12345',
      slug: 'volt_prime_set',
      itemsInSet: []
    };

    mockClient.get.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockItem, error: null }
    });

    const item = await warframeMarket.getItemInfo('volt_prime_set');
    expect(item).toEqual(mockItem);
    expect(mockClient.get).toHaveBeenCalledWith('/item/volt_prime_set');
  });

  test('should get and filter item orders with v2 field names', async () => {
    const mockOrders = [
      { orderType: 'sell', platinum: 100, user: { status: 'ingame' } },
      { orderType: 'sell', platinum: 90, user: { status: 'ingame' } },
      { orderType: 'buy', platinum: 80, user: { status: 'ingame' } },
      { orderType: 'buy', platinum: 85, user: { status: 'ingame' } },
      { orderType: 'sell', platinum: 95, user: { status: 'offline' } } // Should be filtered
    ];

    mockClient.get.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockOrders, error: null }
    });

    const { sellOrders, buyOrders } = await warframeMarket.getItemOrders('volt_prime_set');
    
    // Sell orders sorted ascending
    expect(sellOrders.length).toBe(2);
    expect(sellOrders[0].platinum).toBe(90);
    
    // Buy orders sorted descending
    expect(buyOrders.length).toBe(2);
    expect(buyOrders[0].platinum).toBe(85);
  });

  test('should calculate best prices', async () => {
    const mockOrders = [
      { orderType: 'sell', platinum: 100, user: { status: 'ingame' } },
      { orderType: 'sell', platinum: 90, user: { status: 'ingame' } },
      { orderType: 'buy', platinum: 80, user: { status: 'ingame' } },
      { orderType: 'buy', platinum: 85, user: { status: 'ingame' } }
    ];

    mockClient.get.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockOrders, error: null }
    });

    const prices = await warframeMarket.calculateBestPrices('test_item');

    expect(prices.lowestSell).toBe(90);
    expect(prices.highestBuy).toBe(85);
    expect(prices.optimalSellPrice).toBe(89); // lowestSell - 1
    expect(prices.optimalBuyPrice).toBe(86); // highestBuy + 1
    expect(prices.profitMargin).toBe(5);
    expect(prices.sellOrderCount).toBe(2);
    expect(prices.buyOrderCount).toBe(2);
  });

  test('should create order with v2 format', async () => {
    const mockOrder = {
      id: 'order123',
      item: 'item123',
      orderType: 'sell',
      platinum: 100,
      quantity: 1
    };

    mockClient.post.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockOrder, error: null }
    });

    const order = await warframeMarket.createOrder({
      item: 'item123',
      orderType: 'sell',
      platinum: 100,
      quantity: 1
    });

    expect(order).toEqual(mockOrder);
    expect(mockClient.post).toHaveBeenCalledWith('/profile/orders', expect.any(Object));
  });

  test('should update order', async () => {
    const mockOrder = {
      id: 'order123',
      platinum: 95
    };

    mockClient.put.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockOrder, error: null }
    });

    const order = await warframeMarket.updateOrder('order123', { platinum: 95 });
    expect(order.platinum).toBe(95);
  });

  test('should delete order', async () => {
    mockClient.delete.mockResolvedValue({ status: 200 });

    await expect(warframeMarket.deleteOrder('order123')).resolves.not.toThrow();
    expect(mockClient.delete).toHaveBeenCalledWith('/profile/orders/order123');
  });

  test('should get item statistics', async () => {
    const mockStats = {
      '48hours': [
        { avgPrice: 100, minPrice: 90, maxPrice: 110, volume: 10 }
      ]
    };

    mockClient.get.mockResolvedValue({
      data: { apiVersion: '2.0.0', data: mockStats, error: null }
    });

    const stats = await warframeMarket.getItemStatistics('test_item');
    expect(stats).toEqual(mockStats);
  });

  test('should handle API errors', async () => {
    mockClient.get.mockRejectedValue(new Error('API Error'));

    await expect(warframeMarket.getAllItems()).rejects.toThrow('API Error');
  });

  test('should generate correct asset URLs', () => {
    const path = 'items/images/en/dual_rounds.304395bed5a40d76ddb9a62c76736d94.png';
    const fullUrl = warframeMarket.getAssetUrl(path);
    expect(fullUrl).toBe('https://warframe.market/static/assets/items/images/en/dual_rounds.304395bed5a40d76ddb9a62c76736d94.png');
  });

  test('should return null for empty asset path', () => {
    expect(warframeMarket.getAssetUrl(null)).toBeNull();
    expect(warframeMarket.getAssetUrl('')).toBeNull();
  });
});
