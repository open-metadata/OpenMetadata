/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { expect, test } from '@playwright/test';
import path from 'path';
import { isRepresentativeEntityRun, pickEntityMatrix } from './entityMatrix';

const ENV_KEYS = ['CI', 'PW_ENTITY_MATRIX', 'PW_DIRECT_CHANGED_SPECS'] as const;
const ENTITY_SPEC = path.resolve(__dirname, '..', 'e2e/Pages/Entity.spec.ts');

test.describe.configure({ mode: 'serial' });

test.describe('entity matrix selection', () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  test.beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  test.afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  test('local runs keep the full matrix', () => {
    process.env.PW_ENTITY_MATRIX = 'representative';

    expect(isRepresentativeEntityRun(ENTITY_SPEC)).toBe(false);
  });

  test('CI runs keep the full matrix unless representative is requested', () => {
    process.env.CI = 'true';

    expect(isRepresentativeEntityRun(ENTITY_SPEC)).toBe(false);

    process.env.PW_ENTITY_MATRIX = 'full';

    expect(isRepresentativeEntityRun(ENTITY_SPEC)).toBe(false);
  });

  test('representative CI runs pick the representative set', () => {
    process.env.CI = 'true';
    process.env.PW_ENTITY_MATRIX = 'representative';
    process.env.PW_DIRECT_CHANGED_SPECS = JSON.stringify([
      'playwright/e2e/Pages/CustomProperties.spec.ts',
    ]);

    expect(
      pickEntityMatrix(ENTITY_SPEC, ['table', 'topic'], ['table'])
    ).toEqual(['table']);
  });

  test('a directly changed spec keeps its full matrix', () => {
    process.env.CI = 'true';
    process.env.PW_ENTITY_MATRIX = 'representative';
    process.env.PW_DIRECT_CHANGED_SPECS = JSON.stringify([
      'playwright/e2e/Pages/Entity.spec.ts',
    ]);

    expect(
      pickEntityMatrix(ENTITY_SPEC, ['table', 'topic'], ['table'])
    ).toEqual(['table', 'topic']);
  });

  test('a malformed changed-spec list does not widen the matrix', () => {
    process.env.CI = 'true';
    process.env.PW_ENTITY_MATRIX = 'representative';
    process.env.PW_DIRECT_CHANGED_SPECS = 'not-json';

    expect(isRepresentativeEntityRun(ENTITY_SPEC)).toBe(true);
  });
});
