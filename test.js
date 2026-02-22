// Simple test to verify the API and basic functionality
// Node.js 22 has fetch as a global

async function testAPI() {
  console.log('Testing owockibot API...');
  
  try {
    const response = await fetch('https://explorer.owockibot.xyz/api/treasury');
    const data = await response.json();
    
    console.log('API Response:', data);
    
    if (data.tokenPrice) {
      console.log('✅ API is working');
      console.log(`Current price: $${data.tokenPrice}`);
      console.log(`Market cap: $${data.marketCap?.toLocaleString()}`);
      return true;
    } else {
      console.log('❌ API response missing price data');
      return false;
    }
  } catch (error) {
    console.error('❌ API test failed:', error);
    return false;
  }
}

testAPI();