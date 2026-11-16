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

import { EntityField } from '../constants/Feeds.constants';
import type { Column } from '../generated/entity/data/table';
import type { Field } from '../generated/entity/data/topic';
import type { ChangeDescription } from '../generated/entity/services/databaseService';
import type { EntityDiffProps } from '../interface/EntityVersion.interface';
import type { VersionEntityTypes } from './EntityVersionUtils.interface';
import {
  getColumnsDiff,
  getDomainDiff,
  getEntityTagDiff,
  getEntityVersionTags,
  getOwnerDiff,
  summaryFormatter,
} from './EntityVersionUtilsPure';

describe('getEntityVersionTags', () => {
  it('keeps rendering when tag diffs are malformed', () => {
    const changeDescription: ChangeDescription = {
      fieldsUpdated: [
        {
          name: EntityField.TAGS,
          oldValue: '{invalid',
          newValue: '{invalid',
        },
      ],
    };
    const currentVersionData = { tags: [] } as unknown as VersionEntityTypes;

    expect(getEntityVersionTags(currentVersionData, changeDescription)).toEqual(
      []
    );
  });

  it('keeps rendering when owner and domain diffs are malformed', () => {
    const changeDescription: ChangeDescription = {
      fieldsUpdated: [
        { name: 'owners', oldValue: '{invalid', newValue: '{invalid' },
        { name: 'domains', oldValue: '{invalid', newValue: '{invalid' },
      ],
    };

    expect(getOwnerDiff([], changeDescription).owners).toEqual([]);
    expect(getDomainDiff([], changeDescription).domains).toEqual([]);
  });

  it('formats summaries without throwing for unexpected JSON shapes', () => {
    expect(
      summaryFormatter({ name: EntityField.COLUMNS, newValue: '{}' })
    ).toBe('label.column-lowercase-plural ');
    expect(summaryFormatter({ name: EntityField.TAGS, newValue: '[{}]' })).toBe(
      'label.tag-lowercase-plural '
    );
    expect(summaryFormatter({ name: 'owner', newValue: '[]' })).toBe('owner');
  });

  it('falls back to oldValue when newValue is empty', () => {
    expect(
      summaryFormatter({
        name: EntityField.COLUMNS,
        newValue: '',
        oldValue: '[{"name":"c1"}]',
      })
    ).toBe('label.column-lowercase-plural c1');
    expect(
      summaryFormatter({
        name: EntityField.TAGS,
        newValue: '',
        oldValue: '[{"tagFQN":"PII.Sensitive"}]',
      })
    ).toBe('label.tag-lowercase-plural PII.Sensitive');
    expect(
      summaryFormatter({
        name: 'owner',
        newValue: '',
        oldValue: '{"name":"alice"}',
      })
    ).toBe('owner alice');
  });

  it('handles a tag diff when the current field has no tags', () => {
    const fields = [{ name: 'field' }] as unknown as Field[];

    expect(
      getEntityTagDiff(
        {
          updated: {
            name: 'schemaFields.field.tags',
            oldValue: '[]',
            newValue: '[]',
          },
        },
        'field',
        fields
      )
    ).toEqual(fields);
  });
});

describe('getColumnsDiff', () => {
  it('drops deleted columns whose nested children are malformed', () => {
    // A non-array `children` would crash the recursive column renderer if it
    // reached the table; it must be filtered out before insertion.
    const columnsDiff = {
      deleted: {
        name: 'columns',
        oldValue: '[{"name":"good"},{"name":"bad","children":{"x":1}}]',
        newValue: '',
      },
    } as unknown as EntityDiffProps;

    const result = getColumnsDiff(columnsDiff, [] as Column[], '');

    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).toContain('good');
    expect(JSON.stringify(result)).not.toContain('bad');
  });

  it('marks valid added columns and leaves malformed entries untouched', () => {
    const columnsDiff = {
      added: {
        name: 'columns',
        oldValue: '',
        newValue: '[{"name":"good"},{"name":"bad","children":{"x":1}}]',
      },
    } as unknown as EntityDiffProps;
    const colList = [{ name: 'good' }, { name: 'bad' }] as unknown as Column[];

    const result = getColumnsDiff(columnsDiff, colList);
    const good = result.find((c) => c.name.includes('good'));
    const bad = result.find((c) => c.name === 'bad');

    expect(good?.name).toContain('diff-added');
    expect(bad).toBeDefined();
  });

  it('renders deleted columns with non-string properties without crashing', () => {
    const columnsDiff = {
      deleted: {
        name: 'columns',
        oldValue: '[{"name":"deleted","description":{"text":"bad"}}]',
        newValue: '',
      },
    } as unknown as EntityDiffProps;

    expect(() => getColumnsDiff(columnsDiff, [] as Column[], '')).not.toThrow();

    const result = getColumnsDiff(columnsDiff, [] as Column[], '');

    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).toContain('deleted');
  });
});
