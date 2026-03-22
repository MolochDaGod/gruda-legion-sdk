/**
 * GRUDA Legion SDK — Node.js Example
 *
 * Usage: LEGION_HUB_API_KEY=your-key node examples/node-example.js
 */

const { GrudaLegionNode } = require('../');

async function main() {
  const legion = new GrudaLegionNode({
    apiKey: process.env.LEGION_HUB_API_KEY || 'test-key',
  });

  console.log('=== GRUDA Legion SDK — Node.js Demo ===\n');

  // Health check
  try {
    const h = await legion.health();
    console.log('Health:', JSON.stringify(h, null, 2));
  } catch (e) {
    console.log('Health check failed:', e.message);
  }

  // List agents
  try {
    const agents = await legion.listAgents();
    console.log('\nAgents:', agents.agents?.map(a => `${a.role} (${a.name})`).join(', '));
  } catch (e) {
    console.log('Agent list failed:', e.message);
  }

  // Chat
  try {
    const reply = await legion.chat('What is Grudge Warlords?');
    console.log('\nChat response:', reply.response?.substring(0, 200) + '...');
    console.log('Provider:', reply.provider, '| Model:', reply.model);
  } catch (e) {
    console.log('Chat failed:', e.message);
  }

  // Lore agent
  try {
    const lore = await legion.lore('Write a 2-sentence tavern rumor about a haunted island');
    console.log('\nLore:', lore.response?.substring(0, 200) + '...');
  } catch (e) {
    console.log('Lore failed:', e.message);
  }
}

main().catch(console.error);
