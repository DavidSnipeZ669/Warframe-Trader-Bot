// Mock axios before requiring notification service
jest.mock('axios', () => ({
  post: jest.fn()
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('NotificationService', () => {
  let notificationService;
  let axios;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Set environment variables for testing before requiring the module
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
    
    // Re-require axios mock
    axios = require('axios');
    logger = require('../src/utils/logger');
    
    // Re-require notification service to pick up env changes
    notificationService = require('../src/services/notification');
  });

  afterEach(() => {
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  test('should send Discord notification', async () => {
    axios.post.mockResolvedValue({ status: 200 });

    const result = await notificationService.sendDiscord({
      title: 'Test',
      description: 'Test message',
      color: '00ff00'
    });

    expect(result).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test/token',
      expect.objectContaining({
        username: 'Warframe Trader',
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: 'Test',
            description: 'Test message'
          })
        ])
      })
    );
  });

  test('should handle Discord notification failure', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));

    const result = await notificationService.sendDiscord({
      title: 'Test',
      description: 'Test message'
    });

    expect(result).toBe(false);
  });

  test('should send profitable trade alert', async () => {
    axios.post.mockResolvedValue({ status: 200 });

    await notificationService.sendProfitableTradeAlert({
      itemName: 'volt_prime_set',
      buyPrice: 100,
      sellPrice: 150,
      profitMargin: 50,
      profitPercentage: '50.00',
      tradeType: 'Flip'
    });

    expect(axios.post).toHaveBeenCalled();
    const call = axios.post.mock.calls[0];
    expect(call[1].embeds[0].title).toContain('Profitable Trade');
  });

  test('should send price update alert', async () => {
    axios.post.mockResolvedValue({ status: 200 });

    await notificationService.sendPriceUpdateAlert({
      itemName: 'rhino_prime_set',
      orderType: 'sell',
      oldPrice: 200,
      newPrice: 190,
      reason: 'Market undercut'
    });

    expect(axios.post).toHaveBeenCalled();
    const call = axios.post.mock.calls[0];
    expect(call[1].embeds[0].title).toContain('Price Updated');
  });

  test('should send general notification with color mapping', async () => {
    axios.post.mockResolvedValue({ status: 200 });

    await notificationService.sendNotification('Test Title', 'Test message', 'red');

    expect(axios.post).toHaveBeenCalled();
    const call = axios.post.mock.calls[0];
    expect(call[1].embeds[0].color).toBe(parseInt('ff0000', 16));
  });

  test('should warn when webhook not configured', async () => {
    // Reset modules and unset the webhook URL
    jest.resetModules();
    delete process.env.DISCORD_WEBHOOK_URL;
    
    // Re-require with no webhook configured
    const freshLogger = require('../src/utils/logger');
    const service = require('../src/services/notification');

    const result = await service.sendDiscord({ title: 'Test' });

    expect(result).toBe(false);
    expect(freshLogger.warn).toHaveBeenCalledWith('Discord webhook URL not configured');
  });
});
