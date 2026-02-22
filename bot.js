const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// Bot configuration
const BOT_TOKEN = '7944221528:AAFngyel6UxhPVT68c_PK3aVwBosRattwKg';
const API_URL = 'https://api.dexscreener.com/latest/dex/tokens/0xfDC933Ff4e2980d18beCF48e4E030d8463A2Bb07';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const PRICE_CHANGE_THRESHOLD = 0.05; // 5% threshold

// Data storage
const DATA_FILE = path.join(__dirname, 'bot-data.json');
let botData = {
  subscribers: new Set(),
  subscriberSettings: {}, // chatId -> { threshold: number }
  priceHistory: [],
  lastAlert: null
};
const DEFAULT_THRESHOLD = 5; // 5%

// Load existing data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      botData.subscribers = new Set(data.subscribers || []);
      botData.subscriberSettings = data.subscriberSettings || {};
      botData.priceHistory = data.priceHistory || [];
      botData.lastAlert = data.lastAlert;
      console.log(`Loaded ${botData.subscribers.size} subscribers and ${botData.priceHistory.length} price points`);
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Save data
function saveData() {
  try {
    const data = {
      subscribers: Array.from(botData.subscribers),
      subscriberSettings: botData.subscriberSettings,
      priceHistory: botData.priceHistory.slice(-288),
      lastAlert: botData.lastAlert
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Fetch current price data from DexScreener
async function fetchPriceData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      console.log('No pairs found on DexScreener');
      return null;
    }
    
    const pair = data.pairs[0];
    const price = parseFloat(pair.priceUsd || 0);
    const marketCap = parseFloat(pair.marketCap || pair.fdv || 0);
    const volume24h = parseFloat(pair.volume?.h24 || 0);
    const priceChange1h = parseFloat(pair.priceChange?.h1 || 0);
    const priceChange24h = parseFloat(pair.priceChange?.h24 || 0);
    const liquidity = parseFloat(pair.liquidity?.usd || 0);
    
    console.log(`Fetched price: $${price.toFixed(8)}, Market Cap: $${marketCap.toLocaleString()}, 1h: ${priceChange1h}%`);
    
    return {
      timestamp: Date.now(),
      price,
      marketCap,
      volume24h,
      liquidity,
      priceChange1h,
      priceChange24h,
      pairAddress: pair.pairAddress
    };
  } catch (error) {
    console.error('Error fetching price data:', error);
    return null;
  }
}

// Check price change in last hour
function getPriceChange(currentData) {
  if (!currentData || currentData.price <= 0) return null;
  
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const historicalPrice = botData.priceHistory.find(entry => entry.timestamp <= oneHourAgo);
  
  if (!historicalPrice || historicalPrice.price <= 0) {
    console.log('No historical price data for comparison');
    return null;
  }
  
  const priceChange = (currentData.price - historicalPrice.price) / historicalPrice.price;
  const percentChange = priceChange * 100;
  
  console.log(`Price change in 1h: ${percentChange.toFixed(2)}%`);
  
  return {
    percentChange,
    currentPrice: currentData.price,
    previousPrice: historicalPrice.price,
    marketCap: currentData.marketCap,
    direction: priceChange > 0 ? 'up' : 'down'
  };
}

function getThreshold(chatId) {
  return (botData.subscriberSettings[chatId] && botData.subscriberSettings[chatId].threshold) || DEFAULT_THRESHOLD;
}

// Send alerts to subscribers whose threshold is met
async function sendAlerts(bot, changeData) {
  if (!changeData) return;
  
  const emoji = changeData.direction === 'up' ? '🚀' : '📉';
  const direction = changeData.direction === 'up' ? 'UP' : 'DOWN';
  const changeText = changeData.percentChange > 0 ? `+${changeData.percentChange.toFixed(2)}%` : `${changeData.percentChange.toFixed(2)}%`;
  
  const message = `${emoji} OWOCKIBOT PRICE ALERT!\n\n` +
    `Price moved ${direction} ${changeText} in the last hour!\n\n` +
    `📊 Current Price: $${changeData.currentPrice.toFixed(8)}\n` +
    `📈 Previous Price: $${changeData.previousPrice.toFixed(8)}\n` +
    `💰 Market Cap: $${changeData.marketCap.toLocaleString()}\n\n` +
    `🔗 Trade: https://clanker.world/clanker/0xfdc933ff4e2980d18becf48e4e030d8463a2bb07\n` +
    `📈 Chart: https://dexscreener.com/base/0xfdc933ff4e2980d18becf48e4e030d8463a2bb07`;
  
  let sent = 0;
  for (const chatId of botData.subscribers) {
    const threshold = getThreshold(chatId);
    if (Math.abs(changeData.percentChange) < threshold) continue;
    
    try {
      await bot.telegram.sendMessage(chatId, message);
      sent++;
    } catch (error) {
      console.error(`Failed to send to ${chatId}:`, error.message);
      if (error.response && error.response.error_code === 403) {
        botData.subscribers.delete(chatId);
      }
    }
  }
  
  if (sent > 0) {
    console.log(`Sent alerts to ${sent} subscribers`);
    botData.lastAlert = new Date().toISOString();
    saveData();
  }
}

// Main price monitoring function
async function monitorPrice(bot) {
  console.log('Checking price...');
  
  const currentData = await fetchPriceData();
  if (!currentData) {
    console.log('Failed to fetch price data, skipping this cycle');
    return;
  }
  
  // Add to history
  botData.priceHistory.push(currentData);
  
  // Check for alerts per subscriber
  const changeData = getPriceChange(currentData);
  if (changeData) {
    await sendAlerts(bot, changeData);
  }
  
  // Save data
  saveData();
}

// Format price data for status
function formatStatus() {
  if (botData.priceHistory.length === 0) {
    return '📊 No price data available yet. Monitoring will begin shortly.';
  }
  
  const latest = botData.priceHistory[botData.priceHistory.length - 1];
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const historicalPrice = botData.priceHistory.find(entry => entry.timestamp <= oneHourAgo);
  
  let changeText = '';
  if (historicalPrice) {
    const priceChange = (latest.price - historicalPrice.price) / historicalPrice.price * 100;
    const emoji = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️';
    changeText = `\n${emoji} 1h Change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
  }
  
  return `📊 $OWOCKIBOT Status\n\n` +
    `💰 Price: $${latest.price.toFixed(8)}\n` +
    `📈 Market Cap: $${latest.marketCap.toLocaleString()}\n` +
    `🔵 24h Volume: $${latest.volume24h.toLocaleString()}\n` +
    `💧 Liquidity: $${latest.liquidity.toLocaleString()}\n` +
    `📉 1h Change: ${latest.priceChange1h > 0 ? '+' : ''}${latest.priceChange1h.toFixed(2)}%\n` +
    `📊 24h Change: ${latest.priceChange24h > 0 ? '+' : ''}${latest.priceChange24h.toFixed(2)}%\n` +
    changeText + '\n\n' +
    `⏰ Last Updated: ${new Date(latest.timestamp).toLocaleString()}\n` +
    `📢 Subscribers: ${botData.subscribers.size}\n` +
    `📊 Data Points: ${botData.priceHistory.length}`;
}

// Initialize bot
function initBot() {
  const bot = new Telegraf(BOT_TOKEN);
  
  // Load existing data
  loadData();
  
  // Command handlers
  bot.command('start', (ctx) => {
    const welcomeMessage = `🤖 Welcome to the OWOCKIBOT Price Alert Bot!\n\n` +
      `I monitor the $OWOCKIBOT token price and send alerts when there are significant moves (>5% in 1 hour).\n\n` +
      `📊 Commands:\n` +
      `/subscribe - Subscribe to price alerts\n` +
      `/unsubscribe - Unsubscribe from alerts\n` +
      `/threshold <percent> - Set your alert threshold (default: 5%)\n` +
      `/status - View current price and stats\n\n` +
      `🔗 OWOCKIBOT Links:\n` +
      `• Website: https://owockibot.xyz\n` +
      `• Trade: https://clanker.world/clanker/0xfdc933ff4e2980d18becf48e4e030d8463a2bb07\n` +
      `• Chart: https://dexscreener.com/base/0xfdc933ff4e2980d18becf48e4e030d8463a2bb07`;
    
    ctx.reply(welcomeMessage);
  });
  
  bot.command('subscribe', (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    if (botData.subscribers.has(chatId)) {
      ctx.reply('✅ You are already subscribed to OWOCKIBOT price alerts!');
    } else {
      botData.subscribers.add(chatId);
      saveData();
      ctx.reply(`🔔 Successfully subscribed to OWOCKIBOT price alerts!\n\n` +
        `You will receive notifications when the price moves >5% in 1 hour.\n` +
        `Use /unsubscribe to stop receiving alerts.`);
      console.log(`New subscriber: ${chatId} (${ctx.from.first_name})`);
    }
  });
  
  bot.command('unsubscribe', (ctx) => {
    const chatId = ctx.chat.id.toString();
    
    if (botData.subscribers.has(chatId)) {
      botData.subscribers.delete(chatId);
      saveData();
      ctx.reply('🔕 Successfully unsubscribed from OWOCKIBOT price alerts.');
      console.log(`Unsubscribed: ${chatId}`);
    } else {
      ctx.reply('❌ You are not currently subscribed to price alerts.');
    }
  });
  
  bot.command('threshold', (ctx) => {
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      const current = getThreshold(chatId);
      ctx.reply(`📊 Your current alert threshold: ${current}%\n\nUsage: /threshold <percent>\nExample: /threshold 3 (alert on 3% moves)\nExample: /threshold 10 (alert on 10% moves)\n\nRange: 1-50%`);
      return;
    }
    
    const val = parseFloat(args[1]);
    if (isNaN(val) || val < 1 || val > 50) {
      ctx.reply('❌ Threshold must be between 1 and 50 (percent).');
      return;
    }
    
    if (!botData.subscriberSettings[chatId]) botData.subscriberSettings[chatId] = {};
    botData.subscriberSettings[chatId].threshold = val;
    saveData();
    ctx.reply(`✅ Alert threshold set to ${val}%. You'll be notified when price moves >${val}% in 1 hour.`);
  });

  bot.command('status', async (ctx) => {
    const status = formatStatus();
    await ctx.reply(status);
  });
  
  // Handle unknown commands
  bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      ctx.reply('❓ Unknown command. Use /start to see available commands.');
    }
  });
  
  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    console.error('Context:', ctx);
  });
  
  return bot;
}

// Main function
async function main() {
  console.log('Starting OWOCKIBOT Telegram Alert Bot...');
  
  const bot = initBot();
  
  // Start the bot
  console.log('Starting bot polling...');
  bot.launch();
  
  // Start price monitoring
  console.log('Starting price monitoring...');
  await monitorPrice(bot); // Initial check
  setInterval(() => monitorPrice(bot), POLL_INTERVAL);
  
  // Graceful shutdown
  process.once('SIGINT', () => {
    console.log('Shutting down bot...');
    bot.stop('SIGINT');
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    console.log('Shutting down bot...');
    bot.stop('SIGTERM');
    process.exit(0);
  });
  
  console.log('Bot started successfully!');
  console.log('Bot username: @owockibot_price_bot');
  console.log('Monitoring interval: 5 minutes');
  console.log('Alert threshold: 5% price change in 1 hour');
}

// Start the bot if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
  });
}

module.exports = { main, initBot };