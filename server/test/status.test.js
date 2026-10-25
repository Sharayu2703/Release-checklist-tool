import test from 'node:test';
import assert from 'node:assert/strict';
import { statusFor, DEFAULT_STEPS } from '../src/releaseLogic.js';
import { mapRelease } from '../src/releaseMapping.js';
test('status is planned when no steps are complete', () => assert.equal(statusFor([]), 'planned'));
test('status is ongoing when some but not all steps are complete', () => assert.equal(statusFor([0, 2]), 'ongoing'));
test('status is done only when all default steps are complete', () => assert.equal(statusFor(DEFAULT_STEPS.map((_, i) => i)), 'done'));
test('mapRelease normalizes duplicate and invalid completed step indexes', () => {
 const r = mapRelease({ id: 5, name: 'Ship', due_date: '2026-10-30T10:00:00Z', additional_info: '', completed_steps: [0,0,99,-1], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });
 assert.deepEqual(r.completedSteps, [0]); assert.equal(r.status, 'ongoing'); assert.equal(r.steps.length, 10);
});
