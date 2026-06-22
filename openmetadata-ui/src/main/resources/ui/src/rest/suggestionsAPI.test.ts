/*
 *  Copyright 2024 Collate.
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
import { SuggestionAction } from '../components/Suggestions/SuggestionsProvider/SuggestionsProvider.interface';
import { SuggestionType } from '../types/taskSuggestion';
import APIClient from './index';
import {
  approveRejectAllSuggestions,
  getSuggestionsList,
} from './suggestionsAPI';
import { resolveTask, TaskEntityStatus, TaskResolutionType } from './tasksAPI';

jest.mock('./index', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('./tasksAPI', () => ({
  ...jest.requireActual('./tasksAPI'),
  resolveTask: jest.fn(),
}));

const makeTask = (id: string, fieldPath: string, suggestionType = 'Description') => ({
  id,
  about: { type: 'table', fullyQualifiedName: 'db.schema.my_table' },
  payload: {
    fieldPath,
    suggestionType,
    newDescription: `description for ${id}`,
  },
  status: TaskEntityStatus.Open,
  createdBy: { id: 'user-1', name: 'User 1', type: 'user' },
});

describe('suggestionsAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildEntityLink', () => {
    it('converts flat column fieldPath to :: entity link format', async () => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [makeTask('task-1', 'columns.col_name.description')],
          paging: {},
        },
      });

      const result = await getSuggestionsList();

      expect(result.data[0].entityLink).toBe(
        '<#E::table::db.schema.my_table::columns::col_name>'
      );
    });

    it('preserves dots within nested column names so the column FQN sits at link index [3]', async () => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [makeTask('task-1', 'columns.address.zip.description')],
          paging: {},
        },
      });

      const result = await getSuggestionsList();

      // Correct: columns::address.zip (nested column name kept as-is at index [3])
      // Wrong would be: columns::address::zip (zip lands at index [4] = sub-field slot)
      expect(result.data[0].entityLink).toBe(
        '<#E::table::db.schema.my_table::columns::address.zip>'
      );
    });

    it('returns bare entity link for entity-level description fieldPath', async () => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [makeTask('task-1', 'description')],
          paging: {},
        },
      });

      const result = await getSuggestionsList();

      expect(result.data[0].entityLink).toBe(
        '<#E::table::db.schema.my_table>'
      );
    });

    it('strips .tags suffix and builds correct entity link', async () => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [makeTask('task-1', 'columns.col_name.tags')],
          paging: {},
        },
      });

      const result = await getSuggestionsList();

      expect(result.data[0].entityLink).toBe(
        '<#E::table::db.schema.my_table::columns::col_name>'
      );
    });
  });

  describe('approveRejectAllSuggestions', () => {
    it('continues resolving remaining tasks when one resolveTask call fails', async () => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [
            makeTask('task-1', 'columns.col_1.description'),
            makeTask('task-2', 'columns.col_2.description'),
          ],
          paging: {},
        },
      });

      (resolveTask as jest.Mock)
        .mockRejectedValueOnce(new Error('409 Conflict'))
        .mockResolvedValue({});

      await approveRejectAllSuggestions(
        'user-1',
        'db.schema.my_table',
        SuggestionType.SuggestDescription,
        SuggestionAction.Accept
      );

      expect(resolveTask).toHaveBeenCalledTimes(2);
      expect(resolveTask).toHaveBeenNthCalledWith(1, 'task-1', {
        resolutionType: TaskResolutionType.Approved,
        newValue: 'description for task-1',
      });
      expect(resolveTask).toHaveBeenNthCalledWith(2, 'task-2', {
        resolutionType: TaskResolutionType.Approved,
        newValue: 'description for task-2',
      });
    });

    it('only resolves tasks matching the requested suggestionType, skipping others', async () => {
      (APIClient.get as jest.Mock).mockResolvedValue({
        data: {
          data: [
            makeTask('task-desc', 'columns.col_1.description', 'Description'),
            makeTask('task-tag', 'columns.col_1.tags', 'Tag'),
          ],
          paging: {},
        },
      });

      (resolveTask as jest.Mock).mockResolvedValue({});

      await approveRejectAllSuggestions(
        'user-1',
        'db.schema.my_table',
        SuggestionType.SuggestDescription,
        SuggestionAction.Accept
      );

      expect(resolveTask).toHaveBeenCalledTimes(1);
      expect(resolveTask).toHaveBeenCalledWith('task-desc', expect.any(Object));
    });
  });
});
