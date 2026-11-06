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
import {
  buildStudioUrlParams,
  parseStudioUrlState,
  patchStudioUrlParams,
  StudioUrlMode,
  StudioUrlView,
} from './OntologyStudioUrlState.utils';

const CASES: ReadonlyArray<[StudioUrlMode, StudioUrlView | undefined]> = [
  ['view', undefined],
  ['view', 'tree'],
  ['view', 'ontology'],
  ['edit', undefined],
  ['edit', 'tree'],
  ['edit', 'ontology'],
  ['query', undefined],
  ['query', 'builder'],
  ['ai', undefined],
];

describe('studio URL state', () => {
  it.each(CASES)('round trips %s with view %s', (mode, view) => {
    const built = buildStudioUrlParams(new URLSearchParams(), { mode, view });

    expect(parseStudioUrlState(built)).toEqual({
      ...(mode === 'view' ? {} : { mode }),
      ...(view && !['graph', 'console'].includes(view) ? { view } : {}),
    });
  });

  it('writes the published version and keeps other parameters', () => {
    const built = buildStudioUrlParams(
      new URLSearchParams('ontology=o1&concept=c1'),
      { mode: 'view', view: 'tree', version: 'published' }
    );

    expect(built.toString()).toBe(
      'ontology=o1&concept=c1&view=tree&version=published'
    );
  });

  it('drops values equal to their default', () => {
    const built = buildStudioUrlParams(
      new URLSearchParams('ontology=o1&mode=edit&view=tree&version=published'),
      { mode: 'view', view: 'graph', version: 'draft' }
    );

    expect(built.toString()).toBe('ontology=o1');
  });

  it('keeps mode=view when a draft link would otherwise open Review', () => {
    const built = buildStudioUrlParams(
      new URLSearchParams('draft=d1'),
      { mode: 'view' },
      true
    );

    expect(built.toString()).toBe('draft=d1&mode=view');
  });

  it('ignores unknown values and a view that does not belong to the mode', () => {
    expect(
      parseStudioUrlState(new URLSearchParams('mode=bogus&view=nope&version=x'))
    ).toEqual({});
    expect(
      parseStudioUrlState(new URLSearchParams('mode=query&view=tree'))
    ).toEqual({ mode: 'query' });
  });

  it('removes a view that the target mode does not offer', () => {
    const built = buildStudioUrlParams(new URLSearchParams('view=tree'), {
      mode: 'query',
      view: 'tree',
    });

    expect(built.toString()).toBe('mode=query');
  });
});

describe('patchStudioUrlParams', () => {
  it('changes the named field and keeps the others', () => {
    const next = patchStudioUrlParams(
      new URLSearchParams('ontology=o1&mode=edit&view=tree'),
      { view: 'ontology' }
    );

    expect(next.toString()).toBe('ontology=o1&mode=edit&view=ontology');
  });

  it('clears a field set to undefined', () => {
    const next = patchStudioUrlParams(
      new URLSearchParams('ontology=o1&mode=edit&version=published'),
      { mode: 'edit', version: undefined }
    );

    expect(next.toString()).toBe('ontology=o1&mode=edit');
  });

  it('leaves a draft link in Review until the patch names a mode', () => {
    expect(
      patchStudioUrlParams(new URLSearchParams('draft=d1'), {
        view: 'tree',
      }).toString()
    ).toBe('draft=d1&view=tree');
    expect(
      patchStudioUrlParams(new URLSearchParams('draft=d1'), {
        mode: 'view',
      }).toString()
    ).toBe('draft=d1&mode=view');
  });
});
