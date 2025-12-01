const config = require('../src/config');

describe('Config', () => {
  test('should have warframeMarket v2 configuration', () => {
    expect(config.warframeMarket).toBeDefined();
    expect(config.warframeMarket.baseUrl).toBe('https://api.warframe.market/v2');
    expect(config.warframeMarket.staticAssetsUrl).toBe('https://warframe.market/static/assets/');
    expect(config.warframeMarket.platform).toBe('pc');
    expect(config.warframeMarket.crossplay).toBe(true);
    expect(config.warframeMarket.rateLimit).toBe(3);
  });

  test('should have discord configuration', () => {
    expect(config.discord).toBeDefined();
    expect(config.discord.webhookUrl).toBeDefined();
  });

  test('should have twilio configuration', () => {
    expect(config.twilio).toBeDefined();
    expect(config.twilio.accountSid).toBeDefined();
    expect(config.twilio.authToken).toBeDefined();
  });

  test('should have trading configuration with defaults', () => {
    expect(config.trading).toBeDefined();
    expect(typeof config.trading.minProfitPercentage).toBe('number');
    expect(typeof config.trading.maxPlatinum).toBe('number');
    expect(typeof config.trading.priceCheckInterval).toBe('number');
    expect(typeof config.trading.autoListingEnabled).toBe('boolean');
    expect(typeof config.trading.sellUndercutAmount).toBe('number');
    expect(typeof config.trading.buyOvercutAmount).toBe('number');
  });
});
