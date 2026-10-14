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
import { render, screen } from '@testing-library/react';
import {
  Task,
  TaskEntityStatus,
  TaskEntityType,
} from '../../../../rest/tasksAPI';
import MetadataCompletionTask from './MetadataCompletionTask';

const task = (status: TaskEntityStatus) =>
  ({
    id: 'task-1',
    type: TaskEntityType.MetadataCompletion,
    status,
    payload: {
      workflow: 'DomainLifecycle',
      node: 'Collect0',
      stage: 'Draft',
      targetStage: 'In Review',
      missingFields: ['experts', 'extension.costCenter'],
    },
  } as unknown as Task);

describe('MetadataCompletionTask', () => {
  it('lists each missing field by name and says which stage it unlocks', () => {
    render(<MetadataCompletionTask task={task(TaskEntityStatus.Open)} />);

    expect(
      screen.getByText('message.metadata-completion-move')
    ).toBeInTheDocument();
    expect(screen.getByText('label.expert-plural')).toBeInTheDocument();
    expect(screen.getByText('costCenter')).toBeInTheDocument();
    expect(
      screen.getByText('message.metadata-completion-hint')
    ).toBeInTheDocument();
  });

  it('says the fields are filled in once the task completes', () => {
    render(<MetadataCompletionTask task={task(TaskEntityStatus.Completed)} />);

    expect(
      screen.queryByTestId('metadata-completion-missing-fields')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('message.metadata-completion-filled-in')
    ).toBeInTheDocument();
  });

  it('shows neither the list nor a completion once the asset left the stage', () => {
    render(<MetadataCompletionTask task={task(TaskEntityStatus.Cancelled)} />);

    expect(
      screen.queryByTestId('metadata-completion-missing-fields')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('message.metadata-completion-filled-in')
    ).not.toBeInTheDocument();
  });
});
