const dns = require('dns').promises;
async function test() {
  const { address } = await dns.lookup('mongodb', { family: 4 });
  console.log('IP:', address);
}
test().catch(console.error);
