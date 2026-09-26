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
import type { Field } from '../generated/entity/data/topic';
import type { ChangeDescription } from '../generated/entity/services/databaseService';
import type { VersionEntityTypes } from './EntityVersionUtils.interface';
import {
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
