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
  complementWeight,
  parseOptionalNumber,
  setSignalMaxBoost,
  setStageWeight,
  toEntityDraft,
  toggleHighlightField,
  toggleSearchField,
  updateSearchField,
  upsertFieldValueBoost,
  upsertTermBoost,
  withEntityDraft,
} from './SearchSettings.utils';

describe('SearchSettings.utils', () => {
  it('keeps keyword and semantic weights summing to 1', () => {
    expect(complementWeight(0.4)).toBe(0.6);
    expect(complementWeight(0.7)).toBe(0.3);
    expect(complementWeight(1)).toBe(0);
  });

  it('adds a term boost, or replaces the one for the same tag', () => {
    const tier1 = { field: 'tier.tagFQN', value: 'Tier.Tier1', boost: 5 };
    const pii = { field: 'tags.tagFQN', value: 'PII.Sensitive', boost: 2 };

    expect(upsertTermBoost([tier1], pii)).toEqual([tier1, pii]);
    expect(upsertTermBoost([tier1, pii], { ...tier1, boost: 9 })).toEqual([
      { ...tier1, boost: 9 },
      pii,
    ]);
    expect(upsertTermBoost(undefined, pii)).toEqual([pii]);
  });

  it('adds a field value boost, or replaces the one for the same field', () => {
    const votes = { field: 'totalVotes', factor: 1 };

    expect(
      upsertFieldValueBoost([votes], { field: 'usage', factor: 2 })
    ).toEqual([votes, { field: 'usage', factor: 2 }]);
    expect(upsertFieldValueBoost([votes], { ...votes, factor: 3 })).toEqual([
      { ...votes, factor: 3 },
    ]);
  });

  it('puts a new matching field first with no boost, and removes it when toggled again', () => {
    const fields = [{ field: 'name', boost: 10 }];
    const added = toggleSearchField(fields, 'description');

    expect(added).toEqual([{ field: 'description', boost: 0 }, ...fields]);
    expect(toggleSearchField(added, 'description')).toEqual(fields);
  });

  it('updates one matching field and toggles highlights', () => {
    expect(
      updateSearchField(
        [
          { field: 'name', boost: 10 },
          { field: 'description', boost: 1 },
        ],
        'description',
        { boost: 4 }
      )
    ).toEqual([
      { field: 'name', boost: 10 },
      { field: 'description', boost: 4 },
    ]);
    expect(toggleHighlightField(['name'], 'description')).toEqual([
      'name',
      'description',
    ]);
    expect(toggleHighlightField(['name'], 'name')).toEqual([]);
  });

  it('clears a stage weight or max boost instead of storing 0 when the input is emptied', () => {
    const ranking = {
      stages: [
        { name: 'exact', fields: ['name'], weight: 100 },
        { name: 'phrase', fields: ['name'], weight: 70 },
      ],
      signals: { maxBoost: 2 },
    };

    expect(setStageWeight(ranking, 1, 50).stages).toEqual([
      { name: 'exact', fields: ['name'], weight: 100 },
      { name: 'phrase', fields: ['name'], weight: 50 },
    ]);
    expect(setStageWeight(ranking, 0, null).stages?.[0]).toEqual({
      name: 'exact',
      fields: ['name'],
    });
    expect(setSignalMaxBoost(ranking, 3).signals).toEqual({ maxBoost: 3 });
    expect(setSignalMaxBoost(ranking, null).signals).toEqual({});
  });

  it('parses optional numeric inputs', () => {
    expect(parseOptionalNumber('')).toBeNull();
    expect(parseOptionalNumber('  ')).toBeNull();
    expect(parseOptionalNumber('abc')).toBeNull();
    expect(parseOptionalNumber('1.5')).toBe(1.5);
  });

  it('builds a draft from an entity configuration and writes it back to that entity only', () => {
    const table = { assetType: 'table', searchFields: [{ field: 'name' }] };
    const topic = { assetType: 'topic', searchFields: [{ field: 'name' }] };

    expect(toEntityDraft()).toEqual({
      searchFields: [],
      highlightFields: [],
      termBoosts: [],
      fieldValueBoosts: [],
      scoreMode: undefined,
      boostMode: undefined,
      ranking: undefined,
    });

    const draft = {
      ...toEntityDraft(table),
      searchFields: [{ field: 'description', boost: 3 }],
    };
    const result = withEntityDraft(
      { assetTypeConfigurations: [table, topic] },
      'table',
      draft
    );

    expect(result.assetTypeConfigurations?.[0]).toEqual({
      ...table,
      ...draft,
    });
    expect(result.assetTypeConfigurations?.[1]).toBe(topic);
  });
});
