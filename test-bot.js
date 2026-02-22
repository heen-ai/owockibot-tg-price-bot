// Test script to verify bot functionality
const BOT_TOKEN = '8489723019:AAHlpDyNAclcXergmUkrLnv_lVHMQBaS_tA';

async function testBotAPI() {
  console.log('Testing bot API...');
  
  try {
    // Test getMe
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot API is working');
      console.log(`Bot username: @${data.result.username}`);
      console.log(`Bot name: ${data.result.first_name}`);
      console.log(`Bot ID: ${data.result.id}`);
    } else {
      console.log('❌ Bot API error:', data.description);
    }
    
    // Test webhook info (should be empty for polling)
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();
    
    if (webhookData.ok) {
      console.log('✅ Webhook status:', webhookData.result.url || 'Not set (using polling)');
    }
    
    return data.ok;
  } catch (error) {
    console.error('❌ Bot API test failed:', error);
    return false;
  }
}

testBotAPI();