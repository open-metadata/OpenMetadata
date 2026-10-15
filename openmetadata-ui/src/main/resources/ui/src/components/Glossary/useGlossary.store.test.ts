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
import { act } from 'react';
import { Glossary } from '../../generated/entity/data/glossary';
import { ModifiedGlossary, useGlossaryStore } from './useGlossary.store';

// Focused coverage for `updateActiveGlossary`'s `glossaries` update. The store
// must publish a *new* `glossaries` array reference on every update, otherwise
// referentially-keyed consumers — e.g. the `menuItems` `useMemo` keyed on
// `[glossaries]` in `GlossaryLeftPanel` — never recompute and keep showing a
// stale `displayName` after a `displayName`-only edit that skips the
// `fetchGlossaryList` refresh in `GlossaryPage.updateGlossary`.
describe('useGlossaryStore.updateActiveGlossary', () => {
  const alpha: Glossary = {
    id: 'alpha-id',
    name: 'Alpha',
    displayName: 'Alpha',
    fullyQualifiedName: 'Alpha',
    description: '',
    version: 1.0,
    deleted: false,
  };
  const beta: Glossary = {
    id: 'beta-id',
    name: 'Beta',
    displayName: 'Beta',
    fullyQualifiedName: 'Beta',
    description: '',
    version: 1.0,
    deleted: false,
  };

  beforeEach(() => {
    act(() => {
      useGlossaryStore.setState({
        glossaries: [alpha, beta],
        activeGlossary: alpha as ModifiedGlossary,
        glossaryChildTerms: [],
        termsLoading: false,
      });
    });
  });

  it('updates activeGlossary with the merged patch', () => {
    act(() => {
      useGlossaryStore.getState().updateActiveGlossary({
        displayName: 'Alpha Renamed',
      });
    });

    expect(useGlossaryStore.getState().activeGlossary.displayName).toBe(
      'Alpha Renamed'
    );
    // Untouched fields are preserved from the prior activeGlossary.
    expect(useGlossaryStore.getState().activeGlossary.name).toBe('Alpha');
  });

  it('publishes a fresh glossaries array reference (regression guard for the stale left-panel bug)', () => {
    const beforeArr = useGlossaryStore.getState().glossaries;

    act(() => {
      useGlossaryStore.getState().updateActiveGlossary({
        displayName: 'Alpha Renamed',
      });
    });

    const afterArr = useGlossaryStore.getState().glossaries;

    // The core fix: a new array reference so `[glossaries]`-keyed memos recompute.
    expect(afterArr).not.toBe(beforeArr);
    expect(afterArr[0].displayName).toBe('Alpha Renamed');
  });

  it('does not mutate the existing array or its entries in place', () => {
    const beforeArr = useGlossaryStore.getState().glossaries;
    const beforeSnapshot = beforeArr.map((g) => ({ ...g }));

    act(() => {
      useGlossaryStore.getState().updateActiveGlossary({
        displayName: 'Alpha Renamed',
      });
    });

    // The previously-held array must be left untouched — no in-place mutation.
    expect(beforeArr[0].displayName).toBe('Alpha');
    expect(beforeArr).toEqual(beforeSnapshot);
    expect(beforeArr).toHaveLength(2);
  });

  it('keeps sibling glossaries intact in the new array', () => {
    act(() => {
      useGlossaryStore.getState().updateActiveGlossary({
        displayName: 'Alpha Renamed',
      });
    });

    const { glossaries } = useGlossaryStore.getState();

    expect(glossaries).toHaveLength(2);
    expect(glossaries[0].fullyQualifiedName).toBe('Alpha');
    expect(glossaries[0].displayName).toBe('Alpha Renamed');
    // Beta is preserved by reference identity in the new array.
    expect(glossaries[1]).toBe(beta);
  });

  it('leaves glossaries unchanged when the active glossary is not in the list', () => {
    act(() => {
      useGlossaryStore.setState({
        activeGlossary: {
          id: 'orphan',
          name: 'Orphan',
          fullyQualifiedName: 'Orphan',
          displayName: 'Orphan',
        } as ModifiedGlossary,
      });
    });

    const beforeArr = useGlossaryStore.getState().glossaries;

    act(() => {
      useGlossaryStore.getState().updateActiveGlossary({
        displayName: 'Orphan Renamed',
      });
    });

    // No matching entry -> glossaries array reference and contents are preserved.
    expect(useGlossaryStore.getState().glossaries).toBe(beforeArr);
    expect(useGlossaryStore.getState().activeGlossary.displayName).toBe(
      'Orphan Renamed'
    );
  });
});
