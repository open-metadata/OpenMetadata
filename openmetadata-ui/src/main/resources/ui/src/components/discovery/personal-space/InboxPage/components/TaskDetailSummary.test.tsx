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

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me' } }),
}));

jest.mock(
  '../../../../../components/common/ProfilePicture/ProfilePicture',
  () => ({
    __esModule: true,
    default: ({ isAgent }: { isAgent?: boolean }) =>
      isAgent ? <span data-testid="agent-avatar" /> : <span />,
  })
);

jest.mock(
  '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => ({
    __esModule: true,
    default: ({ markdown }: { markdown: string }) => (
      <p data-testid="callout-markdown">{markdown}</p>
    ),
  })
);

// The stack itself is the core component's; here, only what it is given.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  AvatarGroup: ({
    owners,
    overflowTitleLabel,
  }: {
    owners: { name: string }[];
    overflowTitleLabel: string;
  }) => (
    <div data-testid="avatar-group" data-title={overflowTitleLabel}>
      {owners.map(({ name }) => name).join(',')}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  Task,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../../../rest/tasksAPI';
import { getTaskDetailDescriptor } from '../taskDetail.utils';
import TaskDetailSummary from './TaskDetailSummary';

describe('TaskDetailSummary', () => {
  // The viewer is named as themselves, e.g. "harsh.soni (You)".
  it('marks the viewer in a people row', () => {
    render(
      <TaskDetailSummary
        rows={[
          {
            key: 'approver',
            icon: 'user',
            label: 'Approver',
            value: {
              kind: 'users',
              refs: [{ id: 'me', type: 'user', name: 'harsh' }],
            },
          },
        ]}
      />
    );

    expect(screen.getByText('harsh (label.you)')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-group')).not.toBeInTheDocument();
  });

  it('names an AI agent with its avatar, as it does a person', () => {
    render(
      <TaskDetailSummary
        rows={[
          {
            key: 'createdBy',
            icon: 'owner',
            label: 'Created by',
            value: { kind: 'agent', name: 'Glossary Agent' },
          },
        ]}
      />
    );

    expect(screen.getByTestId('agent-avatar')).toBeInTheDocument();
    expect(screen.getByText('Glossary Agent')).toBeInTheDocument();
  });

  // Several people stack as owners do; the overflow reads "5 Assignees", not
  // "5 Assignee".
  it("stacks several people under the row's plural title", () => {
    render(
      <TaskDetailSummary
        rows={[
          {
            key: 'assignees',
            icon: 'user',
            label: 'Assignee',
            value: {
              kind: 'users',
              title: 'Assignees',
              refs: [
                { id: 'me', type: 'user', name: 'harsh' },
                { id: 'other', type: 'user', name: 'dana' },
              ],
            },
          },
        ]}
      />
    );

    const stack = screen.getByTestId('avatar-group');

    expect(stack).toHaveTextContent('harsh,dana');
    expect(stack).toHaveAttribute('data-title', 'Assignees');
  });

  // Markdown and stored mentions render, not their raw markup.
  it('renders the callout as rich text with mentions in display form', () => {
    render(
      <TaskDetailSummary
        callout={{
          label: 'Context',
          text: '**Need access** for Q3, <#E::user::dana|[@dana](/users/dana)>',
        }}
        rows={[]}
      />
    );

    expect(screen.getByTestId('callout-markdown')).toHaveTextContent(
      '**Need access** for Q3, [@dana](/users/dana)'
    );
  });

  it('renders the resolution note of a closed task through the rich text viewer', () => {
    const comment =
      '<p>Resolved with <#E::user::dana|[@dana](http://localhost:8585/users/dana)></p>';
    const task = {
      type: TaskEntityType.TestCaseResolution,
      status: TaskEntityStatus.Completed,
      resolution: { type: TaskResolutionType.Completed, comment },
    } as Task;
    const { rows } = getTaskDetailDescriptor(task, (key) => key);

    render(<TaskDetailSummary rows={rows} />);

    const preview = screen.getByTestId('callout-markdown');

    expect(preview).toHaveTextContent('data-type="mention"');
    expect(preview).toHaveTextContent('>@dana</a>');
    expect(preview).not.toHaveTextContent('<#E::user::');
  });
});
