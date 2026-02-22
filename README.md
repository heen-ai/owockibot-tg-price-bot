# OWOCKIBOT Telegram Price Alert Bot

A Telegram bot that monitors the OWOCKIBOT token price and sends alerts when there are significant price movements (>5% in 1 hour).

## Features

- **Real-time monitoring**: Polls the owockibot.xyz API every 5 minutes
- **Price alerts**: Sends notifications when price moves >5% in 1 hour
- **Subscriber management**: Users can subscribe/unsubscribe to alerts
- **Price status**: View current price, market cap, and stats
- **Persistent data**: Stores subscriber list and price history

## Bot Commands

- `/start` - Welcome message and bot information
- `/subscribe` - Subscribe to price alerts
- `/unsubscribe` - Unsubscribe from alerts  
- `/status` - View current token price and statistics

## API Integration

Uses the `https://explorer.owockibot.xyz/api/treasury` endpoint to fetch:
- Current token price ($OWOCKIBOT)
- Market capitalization
- 24h trading volume
- Treasury ETH and USDC balances

## Deployment

### Prerequisites
- Node.js 22+
- PM2 process manager
- Valid Telegram bot token

### Setup
```bash
cd /root/workspace/code/owockibot-tg-alert
npm install
pm2 start ecosystem.config.js
```

### Monitoring
```bash
pm2 status owockibot-tg-alert
pm2 logs owockibot-tg-alert
pm2 monit owockibot-tg-alert
```

## Bot Information

- **Username**: @tejthebot
- **Bot ID**: 8489723019
- **Monitoring Interval**: 5 minutes
- **Alert Threshold**: 5% price change in 1 hour
- **Min Alert Interval**: 30 minutes (to prevent spam)

## Data Storage

- Subscriber list stored in `bot-data.json`
- Price history maintained (last 24 hours)
- Automatic cleanup of old data

## Links

- **Trade OWOCKIBOT**: https://clanker.world/clanker/0xfdc933ff4e2980d18becf48e4e030d8463a2bb07
- **Chart**: https://dexscreener.com/base/0xfdc933ff4e2980d18becf48e4e030d8463a2bb07
- **Website**: https://owockibot.xyz

## Author

Built by tej for the OWOCKIBOT ecosystem.