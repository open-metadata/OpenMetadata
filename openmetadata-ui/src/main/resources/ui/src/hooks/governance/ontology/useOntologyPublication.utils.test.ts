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
import { VersionBump } from '../../../generated/api/data/captureOntologyRelease';
import type { PublicationReceipt } from './useOntologyPublication.types';
import {
  readPublicationReceipt,
  savePublicationReceipt,
} from './useOntologyPublication.utils';

const scope = {
  origin: window.location.origin,
  userId: '00000000-0000-4000-8000-000000000001',
  ontologyId: '00000000-0000-4000-8000-000000000002',
};
const attempt: PublicationReceipt = {
  ...scope,
  operation: 'capture',
  phase: 'running',
  intent: 'review',
  metadata: { versionBump: VersionBump.Minor, releaseNotes: 'Original notes' },
  expectedVersion: '1.1.0',
  state: {
    ontologyId: scope.ontologyId,
    workingRevision: 7,
    activationRevision: 3,
    lastReleaseRevision: 5,
  },
};
const storageKey = 'ontology-publication-receipts-v1';

describe('same-tab publication recovery receipt', () => {
  beforeEach(() => sessionStorage.clear());

  it('preserves immutable metadata and revision fences across a reload', () => {
    expect(readPublicationReceipt(scope)).toEqual({
      kind: 'ready',
      value: null,
    });

    savePublicationReceipt(scope, attempt, null);

    expect(readPublicationReceipt(scope)).toEqual({
      kind: 'ready',
      value: attempt,
    });

    savePublicationReceipt(scope, null, attempt);

    expect(readPublicationReceipt(scope)).toEqual({
      kind: 'ready',
      value: null,
    });
  });

  it('does not load another signed-in user or ontology receipt', () => {
    savePublicationReceipt(scope, attempt, null);

    expect(
      readPublicationReceipt({
        ...scope,
        userId: '00000000-0000-4000-8000-000000000003',
      })
    ).toEqual({ kind: 'ready', value: null });
    expect(
      readPublicationReceipt({
        ...scope,
        ontologyId: '00000000-0000-4000-8000-000000000004',
      })
    ).toEqual({ kind: 'ready', value: null });
    expect(readPublicationReceipt(scope)).toEqual({
      kind: 'ready',
      value: attempt,
    });
  });

  it('refuses the ninth unresolved owner without evicting any receipt', () => {
    for (let i = 0; i < 8; i++) {
      const ontologyId = `00000000-0000-4000-8000-${String(i).padStart(
        12,
        '0'
      )}`;
      const receipt: PublicationReceipt = {
        ...attempt,
        ontologyId,
        state: { ...attempt.state, ontologyId },
      };
      savePublicationReceipt(receipt, receipt, null);
    }
    const untouched = sessionStorage.getItem(storageKey);

    expect(
      readPublicationReceipt({
        ...scope,
        ontologyId: '00000000-0000-4000-8000-000000000009',
      }).kind
    ).toBe('unavailable');
    expect(sessionStorage.getItem(storageKey)).toBe(untouched);
  });

  it('bounds serialized UTF-8 bytes and leaves the earlier receipts intact', () => {
    const large: PublicationReceipt = {
      ...attempt,
      metadata: { releaseNotes: '界'.repeat(16384) },
    };
    savePublicationReceipt(scope, large, null);
    const second: PublicationReceipt = {
      ...large,
      ontologyId: scope.userId,
      state: { ...large.state, ontologyId: scope.userId },
    };
    const untouched = sessionStorage.getItem(storageKey);

    expect(() => savePublicationReceipt(second, second, null)).toThrow(
      'storage is full'
    );
    expect(sessionStorage.getItem(storageKey)).toBe(untouched);
  });

  it('does not overwrite an attempt another panel has already begun', () => {
    savePublicationReceipt(scope, attempt, null);

    expect(() => savePublicationReceipt(scope, attempt, null)).toThrow(
      'another panel'
    );
    expect(readPublicationReceipt(scope)).toEqual({
      kind: 'ready',
      value: attempt,
    });
  });

  it.each([
    ['invalid JSON', '{'],
    ['not an array', '{}'],
    [
      'wrong origin',
      JSON.stringify([{ ...attempt, origin: 'https://other.test' }]),
    ],
    ['missing owner', JSON.stringify([{ ...attempt, ontologyId: undefined }])],
    [
      'mismatched fence owner',
      JSON.stringify([
        { ...attempt, state: { ...attempt.state, ontologyId: scope.userId } },
      ]),
    ],
    [
      'negative revision',
      JSON.stringify([
        { ...attempt, state: { ...attempt.state, workingRevision: -1 } },
      ]),
    ],
    [
      'fractional revision',
      JSON.stringify([
        { ...attempt, state: { ...attempt.state, workingRevision: 0.5 } },
      ]),
    ],
    [
      'invalid bump',
      JSON.stringify([{ ...attempt, metadata: { versionBump: 'invented' } }]),
    ],
    [
      'overlong notes',
      JSON.stringify([
        { ...attempt, metadata: { releaseNotes: 'x'.repeat(16385) } },
      ]),
    ],
    [
      'invalid semantic version',
      JSON.stringify([{ ...attempt, expectedVersion: '01.2.3' }]),
    ],
    [
      'unknown operation',
      JSON.stringify([{ ...attempt, operation: 'execute' }]),
    ],
    ['unknown phase', JSON.stringify([{ ...attempt, phase: 'done' }])],
    ['duplicate owner', JSON.stringify([attempt, attempt])],
    ['oversized input', ' '.repeat(65537)],
  ])(
    'disables writes for %s without discarding recovery evidence',
    (_name, raw) => {
      sessionStorage.setItem(storageKey, raw);

      expect(readPublicationReceipt(scope).kind).toBe('unavailable');
      expect(sessionStorage.getItem(storageKey)).toBe(raw);
    }
  );
});
