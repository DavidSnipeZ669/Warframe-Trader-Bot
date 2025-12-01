const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Notification Service
 * Handles sending notifications via Discord webhook and SMS
 */
class NotificationService {
  constructor() {
    this.discordWebhookUrl = config.discord.webhookUrl;
    this.twilioConfig = config.twilio;
  }

  /**
   * Send a Discord webhook notification
   * @param {Object} options - Notification options
   * @param {string} options.title - Embed title
   * @param {string} options.description - Embed description
   * @param {string} options.color - Embed color (hex without #)
   * @param {Array} options.fields - Embed fields
   * @returns {Promise<boolean>} Success status
   */
  async sendDiscord(options) {
    if (!this.discordWebhookUrl) {
      logger.warn('Discord webhook URL not configured');
      return false;
    }

    try {
      const embed = {
        title: options.title || 'Warframe Trader Bot',
        description: options.description || '',
        color: parseInt(options.color || '00ff00', 16),
        fields: options.fields || [],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Warframe Trader Bot'
        }
      };

      await axios.post(this.discordWebhookUrl, {
        username: 'Warframe Trader',
        avatar_url: 'https://i.imgur.com/7kRRNkG.png',
        embeds: [embed]
      });

      logger.info('Discord notification sent');
      return true;
    } catch (error) {
      logger.error('Error sending Discord notification:', error.message);
      return false;
    }
  }

  /**
   * Send an SMS notification via Twilio
   * @param {string} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async sendSMS(message) {
    const { accountSid, authToken, phoneNumber, yourPhoneNumber } = this.twilioConfig;

    if (!accountSid || !authToken || !phoneNumber || !yourPhoneNumber) {
      logger.warn('Twilio not configured');
      return false;
    }

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      
      const params = new URLSearchParams();
      params.append('To', yourPhoneNumber);
      params.append('From', phoneNumber);
      params.append('Body', message);

      await axios.post(twilioUrl, params, {
        auth: {
          username: accountSid,
          password: authToken
        }
      });

      logger.info('SMS notification sent');
      return true;
    } catch (error) {
      logger.error('Error sending SMS notification:', error.message);
      return false;
    }
  }

  /**
   * Send a profitable trade alert
   * @param {Object} tradeInfo - Trade information
   * @returns {Promise<void>}
   */
  async sendProfitableTradeAlert(tradeInfo) {
    const {
      itemName,
      buyPrice,
      sellPrice,
      profitMargin,
      profitPercentage,
      tradeType
    } = tradeInfo;

    // Discord notification with rich embed
    const discordOptions = {
      title: `💰 Profitable Trade Found!`,
      description: `**${itemName.replace(/_/g, ' ')}**`,
      color: '00ff00',
      fields: [
        {
          name: 'Trade Type',
          value: tradeType,
          inline: true
        },
        {
          name: 'Buy Price',
          value: `${buyPrice}p`,
          inline: true
        },
        {
          name: 'Sell Price',
          value: `${sellPrice}p`,
          inline: true
        },
        {
          name: 'Profit',
          value: `${profitMargin}p (${profitPercentage}%)`,
          inline: true
        }
      ]
    };

    // SMS message
    const smsMessage = `[WF Trade] ${itemName.replace(/_/g, ' ')}: Buy ${buyPrice}p, Sell ${sellPrice}p, Profit ${profitMargin}p (${profitPercentage}%)`;

    // Send both notifications
    await Promise.all([
      this.sendDiscord(discordOptions),
      this.sendSMS(smsMessage)
    ]);
  }

  /**
   * Send a price update alert
   * @param {Object} updateInfo - Update information
   * @returns {Promise<void>}
   */
  async sendPriceUpdateAlert(updateInfo) {
    const {
      itemName,
      orderType,
      oldPrice,
      newPrice,
      reason
    } = updateInfo;

    const discordOptions = {
      title: `📊 Price Updated`,
      description: `**${itemName.replace(/_/g, ' ')}**`,
      color: 'ffff00',
      fields: [
        {
          name: 'Order Type',
          value: orderType,
          inline: true
        },
        {
          name: 'Old Price',
          value: `${oldPrice}p`,
          inline: true
        },
        {
          name: 'New Price',
          value: `${newPrice}p`,
          inline: true
        },
        {
          name: 'Reason',
          value: reason,
          inline: false
        }
      ]
    };

    await this.sendDiscord(discordOptions);
  }

  /**
   * Send a general notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} color - Color (green, yellow, red)
   * @returns {Promise<void>}
   */
  async sendNotification(title, message, color = 'green') {
    const colorMap = {
      green: '00ff00',
      yellow: 'ffff00',
      red: 'ff0000',
      blue: '0099ff'
    };

    await this.sendDiscord({
      title,
      description: message,
      color: colorMap[color] || colorMap.green
    });
  }

  /**
   * Send bot status notification
   * @param {string} status - Status message
   * @returns {Promise<void>}
   */
  async sendStatusNotification(status) {
    await this.sendDiscord({
      title: '🤖 Bot Status',
      description: status,
      color: '0099ff'
    });
  }
}

module.exports = new NotificationService();
