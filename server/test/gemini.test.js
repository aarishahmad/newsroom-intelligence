import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assist } from '../src/services/integrations.js';

test('Gemini failures have safe, distinct messages and success preserves output', async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-secret';
  try {
    for (const [http, expected, text] of [
      [503,503,/overloaded/], [429,429,/quota/], [404,502,/model is unavailable/], [403,502,/credentials/], [500,502,/HTTP 500/],
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify({error:{message:'test-only-secret'}}), {status:http});
      await assert.rejects(assist('test','fictional'), e => e.status === expected && text.test(e.message) && !e.message.includes('test-only-secret'));
    }
    globalThis.fetch = async () => { throw new DOMException('Timeout', 'TimeoutError'); };
    await assert.rejects(assist('test','fictional'), e => e.status === 504);
    globalThis.fetch = async () => new Response(JSON.stringify({candidates:[{content:{parts:[{text:'AI-generated suggestion'}]}}]}));
    assert.equal(await assist('test','fictional'), 'AI-generated suggestion');
  } finally {
    globalThis.fetch = oldFetch;
    if(oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  }
});
