require('dotenv').config();

const config = {
  // Warframe Market API v2
  warframeMarket: {
    baseUrl: 'https://api.warframe.market/v2',
    staticAssetsUrl: 'https://warframe.market/static/assets/',
    jwt: process.env.WARFRAME_MARKET_JWT || '',
    platform: process.env.WARFRAME_PLATFORM || 'pc',
    crossplay: process.env.WARFRAME_CROSSPLAY !== 'false', // Default true
    rateLimit: 3 // requests per second
  },

  // Discord Webhook
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || ''
  },

  // Twilio SMS
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    yourPhoneNumber: process.env.YOUR_PHONE_NUMBER || ''
  },

  // Trading Configuration
  trading: {
    minProfitPercentage: parseFloat(process.env.MIN_PROFIT_PERCENTAGE) || 5,
    maxPlatinum: parseInt(process.env.MAX_PLATINUM_FOR_ORDERS, 10) || 500,
    priceCheckInterval: parseInt(process.env.PRICE_CHECK_INTERVAL, 10) || 5,
    autoListingEnabled: process.env.AUTO_LISTING_ENABLED !== 'false',
    sellUndercutAmount: parseInt(process.env.SELL_UNDERCUT_AMOUNT, 10) || 1,
    buyOvercutAmount: parseInt(process.env.BUY_OVERCUT_AMOUNT, 10) || 1
  }
};

module.exports = config;
