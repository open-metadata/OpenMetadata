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
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../generated/entity/tasks/task';
import {
  getKnowledgeCenterPagePath,
  getTaskDetailPathFromTask,
} from './TaskNavigationUtils';
import { getTaskDetailPath } from './TaskUtils';

describe('getKnowledgeCenterPagePath', () => {
  it('points at the Context Center article route', () => {
    // /knowledge-center/<fqn> is not a registered route — only the landing page is — so a task
    // opened from an article used to land on a page that does not resolve.
    expect(
      getKnowledgeCenterPagePath('Onboarding.Runbook', 'tasks', 'open')
    ).toBe('/context-center/articles/Onboarding.Runbook/tasks/open');
  });

  it('encodes the page FQN', () => {
    expect(
      getKnowledgeCenterPagePath('Onboarding.My Runbook', 'tasks', 'open')
    ).toBe('/context-center/articles/Onboarding.My%20Runbook/tasks/open');
  });
});

describe('native ontology review routes', () => {
  it('opens the release review task', () => {
    const task: Task = {
      id: 'task-id',
      name: 'Review',
      type: TaskType.RequestApproval,
      status: TaskStatus.Open,
      category: TaskCategory.Approval,
      createdBy: { id: 'author-id', type: 'user' },
      about: {
        id: 'definition-id',
        type: 'ontologyRelease',
        fullyQualifiedName: 'Organization.Customer',
      },
    };

    expect(getTaskDetailPathFromTask(task)).toBe('/tasks/task-id');
    expect(getTaskDetailPath(task)).toBe('/tasks/task-id');
  });
});
