
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.NODE_ENV = 'test';

const { app } = await import('../src/server.js');

let baseUrl = '';

before(async () => {
  baseUrl = await app.listen({
    port: 0,
    host: '127.0.0.1',
  });
});

after(async () => {
  await app.close();
});

test('GET /health returns status ok', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'ok');
});

test('POST /monitors rejects an invalid URL', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/monitors',
    payload: {
      name: 'Invalid URL',
      url: 'not-a-valid-url',
    },
  });

  assert.equal(response.statusCode, 400);
});

test('Monitor check detects a healthy service', async () => {
  const createResponse = await app.inject({
    method: 'POST',
    url: '/monitors',
    payload: {
      name: 'Test Healthy Service',
      url: `${baseUrl}/health`,
    },
  });

  assert.equal(createResponse.statusCode, 201);

  const monitor = createResponse.json() as { id: string };

  const checkResponse = await app.inject({
    method: 'POST',
    url: `/monitors/${monitor.id}/check`,
    payload: {},
  });

  const result = checkResponse.json();

  assert.equal(checkResponse.statusCode, 200);
  assert.equal(result.status, 'up');
  assert.equal(result.statusCode, 200);
  assert.equal(typeof result.responseTimeMs, 'number');

  const historyResponse = await app.inject({
    method: 'GET',
    url: `/monitors/${monitor.id}/history`,
  });

  assert.equal(historyResponse.statusCode, 200);
  assert.equal(historyResponse.json().length, 1);
});

test('Monitor check detects HTTP 404', async () => {
  const createResponse = await app.inject({
    method: 'POST',
    url: '/monitors',
    payload: {
      name: 'Test Missing Page',
      url: `${baseUrl}/not-found`,
    },
  });

  const monitor = createResponse.json() as { id: string };

  const checkResponse = await app.inject({
    method: 'POST',
    url: `/monitors/${monitor.id}/check`,
    payload: {},
  });

  const result = checkResponse.json();

  assert.equal(result.status, 'down');
  assert.equal(result.statusCode, 404);
  assert.equal(result.error, 'HTTP 404');
});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  