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

// `resolveEffectiveAppMode` lives in `useAppMode.ts` (not
// `useResolvedAppMode.ts`, despite the similar name) — it's the shared
// precedence helper consumed by both the async resolver hook and
// `AuthProvider`'s boot-time bootstrap. This test guards its 3-arg
// (userPref, personaMode, appDefault) contract so persona can never be
// silently dropped from the precedence chain.
import { resolveEffectiveAppMode } from '../../hooks/useAppMode';

describe('AppMode resolver contract (guard)', () => {
  it('accepts (userPref, personaMode, appDefault) in that order', () => {
    // This test exists to catch accidental persona removal. If
    // resolveEffectiveAppMode's signature changes, update the spec too.
    expect(resolveEffectiveAppMode.length).toBe(3);
    expect(resolveEffectiveAppMode('ai', null, null)).toBe('ai');
    expect(resolveEffectiveAppMode(null, 'ai', null)).toBe('ai');
    expect(resolveEffectiveAppMode(null, null, 'ai')).toBe('ai');
  });
});
