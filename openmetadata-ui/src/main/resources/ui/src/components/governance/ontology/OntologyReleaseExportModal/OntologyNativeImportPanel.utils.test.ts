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

import { Format } from '../../../../generated/api/data/nativeOntologyImportSummary';
import {
  INITIAL_NATIVE_IMPORT_STATE,
  landOnImportedOntology,
  nativeImportOntologyRequest,
  nativeImportReducer,
  nativeImportStep,
} from './OntologyNativeImportPanel.utils';

const summary = {
  detectedFormat: Format.Turtle,
  counts: {
    newConcepts: 1,
    updatedConcepts: 0,
    newProperties: 0,
    updatedProperties: 0,
    newRelations: 0,
    newMappings: 0,
    skippedDefinitions: 0,
    skippedRelations: 0,
  },
};

describe('nativeImportReducer', () => {
  it('moves from drop to parse to import as the file is chosen and parsed', () => {
    let state = INITIAL_NATIVE_IMPORT_STATE;

    expect(nativeImportStep(state)).toBe('drop');

    state = nativeImportReducer(state, {
      type: 'fileChosen',
      token: 1,
      fileName: 'a.ttl',
    });

    expect(nativeImportStep(state)).toBe('parse');

    state = nativeImportReducer(state, { type: 'parseStarted', token: 2 });
    state = nativeImportReducer(state, { type: 'parsed', parseId: 2, summary });

    expect(nativeImportStep(state)).toBe('import');
  });

  it('drops the earlier preview and ignores its late answer when a replacement file is rejected', () => {
    let state = nativeImportReducer(INITIAL_NATIVE_IMPORT_STATE, {
      type: 'fileChosen',
      token: 1,
      fileName: 'a.ttl',
    });
    state = nativeImportReducer(state, { type: 'parseStarted', token: 2 });
    state = nativeImportReducer(state, { type: 'parsed', parseId: 2, summary });

    state = nativeImportReducer(state, {
      type: 'fileRejected',
      token: 3,
      message: 'too big',
    });

    expect(state.parse).toEqual({ kind: 'idle' });
    expect(state.fileName).toBeUndefined();
    expect(state.detection).toEqual({ kind: 'failed', message: 'too big' });
    expect(nativeImportStep(state)).toBe('drop');

    expect(
      nativeImportReducer(state, { type: 'parsed', parseId: 2, summary }).parse
    ).toEqual({ kind: 'idle' });
  });

  it('ignores a detection answer for a file that is no longer chosen', () => {
    let state = nativeImportReducer(INITIAL_NATIVE_IMPORT_STATE, {
      type: 'fileChosen',
      token: 1,
      fileName: 'a.ttl',
    });
    state = nativeImportReducer(state, {
      type: 'fileChosen',
      token: 2,
      fileName: 'b.csv',
    });
    state = nativeImportReducer(state, {
      type: 'detected',
      fileId: 1,
      format: 'turtle',
    });

    expect(state.detection).toEqual({ kind: 'pending' });

    state = nativeImportReducer(state, {
      type: 'detected',
      fileId: 2,
      format: 'csv',
    });

    expect(state.detection).toEqual({ kind: 'ready', format: 'csv' });
  });

  it('drops a parse answer that arrives after the file or target changed', () => {
    let state = nativeImportReducer(INITIAL_NATIVE_IMPORT_STATE, {
      type: 'fileChosen',
      token: 1,
      fileName: 'a.ttl',
    });
    state = nativeImportReducer(state, { type: 'parseStarted', token: 2 });
    state = nativeImportReducer(state, {
      type: 'targetChanged',
      token: 3,
      target: 'new',
    });
    state = nativeImportReducer(state, { type: 'parsed', parseId: 2, summary });

    expect(state.parse).toEqual({ kind: 'idle' });
    expect(state.target).toBe('new');
  });

  it('resets the parse when the target changes but keeps the detection', () => {
    let state = nativeImportReducer(INITIAL_NATIVE_IMPORT_STATE, {
      type: 'fileChosen',
      token: 1,
      fileName: 'a.ttl',
    });
    state = nativeImportReducer(state, {
      type: 'detected',
      fileId: 1,
      format: 'turtle',
    });
    state = nativeImportReducer(state, { type: 'parseStarted', token: 2 });
    state = nativeImportReducer(state, { type: 'parsed', parseId: 2, summary });
    state = nativeImportReducer(state, {
      type: 'targetChanged',
      token: 3,
      target: 'new',
    });

    expect(state.parse).toEqual({ kind: 'idle' });
    expect(state.detection).toEqual({ kind: 'ready', format: 'turtle' });
  });
});

describe('nativeImportOntologyRequest', () => {
  it('names the ontology from the file label with a unique urn identity and the user as owner', () => {
    const request = nativeImportOntologyRequest('Fibo Sample!', 'x.ttl', 'u1');

    expect(request.displayName).toBe('Fibo Sample!');
    expect(request.name).toMatch(/^fibo-sample-[0-9a-f-]{36}$/);
    expect(request.iri).toMatch(/^urn:openmetadata:ontology:[0-9a-f-]{36}$/);
    expect(request.namespace).toBe(`${request.iri}:`);
    expect(request.owners).toEqual([{ id: 'u1', type: 'user' }]);
  });

  it('falls back to the file name without its extension', () => {
    const request = nativeImportOntologyRequest(
      undefined,
      'terms.v2.csv',
      'u1'
    );

    expect(request.displayName).toBe('terms.v2');
    expect(request.name).toMatch(/^terms-v2-/);
  });

  it('generates a different identity on every call', () => {
    expect(nativeImportOntologyRequest('A', 'a.ttl', 'u').iri).not.toBe(
      nativeImportOntologyRequest('A', 'a.ttl', 'u').iri
    );
  });
});

describe('landOnImportedOntology', () => {
  it('selects the ontology and clears the concept, scope, and draft', () => {
    const next = landOnImportedOntology(
      new URLSearchParams('concept=c&scope=all&draft=d&mode=edit'),
      'o1'
    );

    expect(next.toString()).toBe('mode=edit&ontology=o1');
  });
});
