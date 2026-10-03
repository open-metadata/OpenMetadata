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
  Pipeline,
} from '../generated/entity/data/pipeline';
import { getUpdatedPipelineTasks } from './PipelineVersionUtils';

describe('getUpdatedPipelineTasks', () => {
  it('keeps rendering when task tag diffs are malformed', () => {
    const currentVersionData = {
      tasks: [{ name: 'task' }],
    } as unknown as Pipeline;
    const changeDescription: ChangeDescription = {
      fieldsUpdated: [
        {
          name: `${EntityField.TASKS}.task.${EntityField.TAGS}`,
          oldValue: '{invalid',
          newValue: '{invalid',
        },
      ],
    };

    expect(
      getUpdatedPipelineTasks(currentVersionData, changeDescription)
    ).toHaveLength(1);
  });

  it('ignores malformed added and deleted task diffs', () => {
    const currentVersionData = {
      tasks: [{ name: 'task', tags: [] }],
    } as unknown as Pipeline;
    const changeDescription: ChangeDescription = {
      fieldsAdded: [
        {
          name: EntityField.TASKS,
          oldValue: '',
          newValue: '[{"name":"task","tags":{}}]',
        },
      ],
      fieldsDeleted: [
        { name: EntityField.TASKS, oldValue: '{invalid', newValue: '' },
      ],
    };

    expect(
      getUpdatedPipelineTasks(currentVersionData, changeDescription)
    ).toEqual(currentVersionData.tasks);
  });
});
