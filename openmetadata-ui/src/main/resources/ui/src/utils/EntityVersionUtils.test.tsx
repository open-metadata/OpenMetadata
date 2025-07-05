/*
 *  Copyright 2023 Collate.
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

import { ChangeDescription } from '../generated/entity/services/databaseService';
import { getComputeRowCountDiffDisplay } from './EntityVersionUtils';

describe('getComputeRowCountDiffDisplay', () => {
  it('should return fallback value as string when no diff exists', () => {
    const changeDescription: ChangeDescription = {
      fieldsAdded: [],
      fieldsDeleted: [],
      fieldsUpdated: [],
    };

    const result = getComputeRowCountDiffDisplay(changeDescription, true);

    expect(result).toBe('true');
  });

  it('should return diff elements when field is updated', () => {
    const changeDescription: ChangeDescription = {
      fieldsAdded: [],
      fieldsDeleted: [],
      fieldsUpdated: [
        {
          name: 'computePassedFailedRowCount',
          oldValue: 'false',
          newValue: 'true',
        },
      ],
    };

    const result = getComputeRowCountDiffDisplay(changeDescription, false);

    // Should return an array of React elements for diff display
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return added diff element when field is added', () => {
    const changeDescription: ChangeDescription = {
      fieldsAdded: [
        {
          name: 'computePassedFailedRowCount',
          newValue: 'true',
        },
      ],
      fieldsDeleted: [],
      fieldsUpdated: [],
    };

    const result = getComputeRowCountDiffDisplay(changeDescription, false);

    // Should return a React element for added diff
    expect(result).toBeDefined();
  });

  it('should return removed diff element when field is deleted', () => {
    const changeDescription: ChangeDescription = {
      fieldsAdded: [],
      fieldsDeleted: [
        {
          name: 'computePassedFailedRowCount',
          oldValue: 'true',
        },
      ],
      fieldsUpdated: [],
    };

    const result = getComputeRowCountDiffDisplay(changeDescription, false);

    // Should return a React element for removed diff
    expect(result).toBeDefined();
  });
});
