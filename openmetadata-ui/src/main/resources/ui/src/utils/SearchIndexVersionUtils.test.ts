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
import type {
  ChangeDescription,
  SearchIndex,
} from '../generated/entity/data/searchIndex';
import { getUpdatedSearchIndexFields } from './SearchIndexVersionUtils';

describe('getUpdatedSearchIndexFields', () => {
  it('keeps rendering when field tag diffs are malformed', () => {
    const currentVersionData = {
      fields: [{ name: 'field' }],
    } as unknown as SearchIndex;
    const changeDescription: ChangeDescription = {
      fieldsUpdated: [
        {
          name: `${EntityField.FIELDS}.field.${EntityField.TAGS}`,
          oldValue: '{invalid',
          newValue: '{invalid',
        },
      ],
    };

    expect(
      getUpdatedSearchIndexFields(currentVersionData, changeDescription)
    ).toHaveLength(1);
  });

  it('applies valid field additions and ignores malformed deletions', () => {
    const currentVersionData = {
      fields: [{ name: 'field', tags: [] }],
    } as unknown as SearchIndex;
    const changeDescription: ChangeDescription = {
      fieldsAdded: [
        {
          name: EntityField.FIELDS,
          oldValue: '',
          newValue: JSON.stringify([{ name: 'field', tags: [] }]),
        },
      ],
      fieldsDeleted: [
        {
          name: EntityField.FIELDS,
          oldValue: '[{"name":"deleted","tags":{}}]',
          newValue: '',
        },
      ],
    };

    const result = getUpdatedSearchIndexFields(
      currentVersionData,
      changeDescription
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('diff-added');
  });
});
