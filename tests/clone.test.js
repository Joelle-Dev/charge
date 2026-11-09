import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive, ref } from 'vue';
import { toCloneable } from '../src/lib/clone.js';

test('toCloneable turns reactive proxies into clonable plain data', () => {
  const stageIds = ref(['a', 'b']).value;
  const sourceStages = reactive([{ id: 'b', name: 'B', budget: null }]);
  const movedExpenses = reactive([['e2', 'b']]);

  const message = toCloneable({
    type: 'mergeStages',
    stageIds,
    targetId: 'a',
    sourceStages,
    movedExpenses
  });

  structuredClone(message); // must not throw
  assert.deepEqual(message.stageIds, ['a', 'b']);
  assert.equal(message.sourceStages[0].id, 'b');
  assert.deepEqual(message.movedExpenses[0], ['e2', 'b']);
});

test('toCloneable keeps dates and passes primitives through', () => {
  const when = new Date('2026-01-01T00:00:00Z');
  const out = toCloneable({ when, count: 3, name: 'x', flag: true, missing: null });
  assert.equal(out.when, when);
  assert.equal(out.count, 3);
  assert.equal(out.missing, null);
  structuredClone(out);
});
