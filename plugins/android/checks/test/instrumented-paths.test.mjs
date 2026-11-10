// Körs av claude-androids CI (test.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instrumentedPathspecs } from '../instrumented-paths.mjs';

test('filtret instrumented blir git-pathspecs', () => {
  const yaml = `
          filters: |
            app:
              - 'app/**'
            instrumented:
              - 'app/src/**'
              - 'firestore.rules'
`;
  assert.deepEqual(instrumentedPathspecs(yaml), [':(glob)app/src/**', ':(glob)firestore.rules']);
  assert.throws(() => instrumentedPathspecs("filters: |\n  app:\n    - 'app/**'\n"), /instrumented saknas/);
});
