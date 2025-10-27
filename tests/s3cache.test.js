const test = require('node:test');
const assert = require('node:assert/strict');

const { __testables } = require('../dist/nodes/S3cache/S3cache.node.js');

test('canonicalKey encodes reserved path characters per segment', () => {
	const { canonicalKey } = __testables;
	const rawKey = "folder name/file!*'()";
	const result = canonicalKey(rawKey);
	assert.equal(result, 'folder%20name/file%21%2A%27%28%29');
});

test('bufferFromResponse unwraps nested bodies and strings', () => {
	const { bufferFromResponse } = __testables;
	const fromString = bufferFromResponse('payload');
	assert.equal(fromString?.toString(), 'payload');

	const nested = bufferFromResponse({ body: 'nested' });
	assert.equal(nested?.toString(), 'nested');
});

test('evaluateCacheFreshness respects TTL boundaries', () => {
	const { evaluateCacheFreshness } = __testables;
	const originalNow = Date.now;
	const fixedNow = Date.now();
	Date.now = () => fixedNow;

	try {
		const fiveSecondsAgo = new Date(fixedNow - 5 * 1000);
		assert.deepEqual(evaluateCacheFreshness(fiveSecondsAgo, 10), {
			fresh: true,
			ttlSeconds: 10,
			ageSeconds: 5,
		});
		assert.deepEqual(evaluateCacheFreshness(fiveSecondsAgo, 4), {
			fresh: false,
			ttlSeconds: 4,
			reason: 'expired',
			ageSeconds: 5,
		});
		assert.deepEqual(evaluateCacheFreshness(null, 10), {
			fresh: false,
			ttlSeconds: 10,
			reason: 'missingLastModified',
		});
		assert.deepEqual(evaluateCacheFreshness(fiveSecondsAgo, 0), {
			fresh: false,
			ttlSeconds: 0,
			reason: 'invalidTtl',
		});
	} finally {
		Date.now = originalNow;
	}
});
