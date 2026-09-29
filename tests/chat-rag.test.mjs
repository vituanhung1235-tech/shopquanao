import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';
import { deleteProductIndex } from '../functions/api/rag.js';

function createTestEnvironment() {
    let lowScore = false;
    let llmCalls = 0;
    const indexed = [];
    const deleted = [];
    const env = {
        CHAT_REINDEX_SECRET: 'test-secret',
        AI: {
            run: async (model, input) => {
                if (model === '@cf/baai/bge-m3') {
                    return { data: input.text.map(() => Array(1024).fill(0.2)) };
                }
                llmCalls += 1;
                return { response: 'Áo cotton giá 150.000 VND.' };
            }
        },
        VECTORIZE: {
            upsert: async vectors => { indexed.push(...vectors); },
            deleteByIds: async ids => { deleted.push(...ids); },
            query: async () => ({
                matches: [{
                    score: lowScore ? 0.1 : 0.9,
                    metadata: { product_id: '15', name: 'Áo cotton', price: 150000, stock: 3 }
                }]
            })
        },
        DB: {
            prepare: () => ({
                all: async () => ({
                    results: [{
                        id: 15,
                        name: 'Áo cotton',
                        category: 'nam',
                        price: 150000,
                        description: 'Cotton',
                        image_url: 'a.jpg',
                        stock: 3,
                        is_active: 1
                    }]
                })
            })
        }
    };

    return {
        env,
        indexed,
        deleted,
        get llmCalls() { return llmCalls; },
        setLowScore(value) { lowScore = value; }
    };
}

function createRequest(path, body, authorization, method = 'POST') {
    return new Request(`https://shop.test/api${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: authorization } : {})
        },
        body: JSON.stringify(body)
    });
}

test('answers from retrieved products and returns product sources', async () => {
    const state = createTestEnvironment();
    const response = await onRequest({
        request: createRequest('/chat', { message: 'Áo cotton giá bao nhiêu?' }),
        env: state.env
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.answer, 'Áo cotton giá 150.000 VND.');
    assert.equal(result.sources[0].product_id, '15');
    assert.equal(state.llmCalls, 1);
});

test('refuses low-similarity results without calling the LLM', async () => {
    const state = createTestEnvironment();
    state.setLowScore(true);
    const response = await onRequest({
        request: createRequest('/chat', { message: 'Tổng thống Mỹ là ai?' }),
        env: state.env
    });

    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.sources.length, 0);
    assert.match(result.answer, /không tìm thấy sản phẩm/);
    assert.equal(state.llmCalls, 0);
});

test('validates message length and requires a secret for re-index', async () => {
    const state = createTestEnvironment();
    const tooLong = await onRequest({
        request: createRequest('/chat', { message: 'x'.repeat(501) }),
        env: state.env
    });
    assert.equal(tooLong.status, 400);

    const unauthorized = await onRequest({
        request: createRequest('/chat/reindex', {}, 'Bearer wrong'),
        env: state.env
    });
    assert.equal(unauthorized.status, 401);

    const reindex = await onRequest({
        request: createRequest('/chat/reindex', {}, 'Bearer test-secret'),
        env: state.env
    });
    assert.equal(reindex.status, 200);
    assert.equal(state.indexed[0].id, 'product_15');
});

test('deletes the matching Vectorize id', async () => {
    const state = createTestEnvironment();
    await deleteProductIndex(state.env, 15);
    assert.deepEqual(state.deleted, ['product_15']);
});

test('hiding a product removes it from Vectorize and reactivating it re-indexes it', async () => {
    const state = createTestEnvironment();
    const product = {
        id: 15,
        name: 'Áo cotton',
        category: 'nam',
        price: 150000,
        description: 'Cotton',
        image_url: 'a.jpg',
        stock: 3,
        is_active: 1
    };
    state.env.DB = {
        prepare: query => ({
            bind: (...values) => ({
                first: async () => query.startsWith('SELECT') ? product : null,
                run: async () => {
                    if (query.startsWith('UPDATE')) product.is_active = values[7];
                }
            })
        })
    };

    const hidden = await onRequest({
        request: createRequest('/products/15', { is_active: false }, undefined, 'PUT'),
        env: state.env
    });
    assert.equal(hidden.status, 200);
    assert.deepEqual(state.deleted, ['product_15']);

    const reactivated = await onRequest({
        request: createRequest('/products/15', { is_active: true, price: 160000 }, undefined, 'PUT'),
        env: state.env
    });
    assert.equal(reactivated.status, 200);
    assert.equal(state.indexed.at(-1).id, 'product_15');
    assert.equal(state.indexed.at(-1).metadata.price, 160000);
});

test('admin page inline scripts have valid JavaScript syntax', () => {
    const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
    const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
        .map(match => match[1].trim())
        .filter(Boolean);

    assert.ok(inlineScripts.length > 0);
    inlineScripts.forEach(script => new Script(script));
});