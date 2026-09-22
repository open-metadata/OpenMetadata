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
import { ReactNode } from 'react';

const mockGetContributions = jest.fn();

jest.mock(
  '../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
    }),
  })
);

jest.mock('utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('utils/date-time/DateTimeUtils'),
  formatDate: (ts: number) => `date-${ts}`,
}));

// Boundary stub: the real chip renders the OSS user popover.
jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('utils/FeedUtilsPure', () => ({
  getFrontEndFormat: (message: string) => `fmt:${message}`,
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({
    markdown,
    className,
  }: {
    markdown: string;
    className?: string;
  }) => (
    <div className={className} data-testid="desc-preview">
      {markdown}
    </div>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <button data-testid={testId}>{children}</button>,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { Task } from '../../../../../generated/entity/tasks/task';
import { EXTENSION_POINTS } from '../../../../../utils/ExtensionPointTypes';
import TaskOverview from './TaskOverview';

describe('TaskOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No plugin panels contributed: the generic overview renders.
    mockGetContributions.mockReturnValue([]);
  });

  it('renders a plugin-contributed panel in place of the generic overview', () => {
    mockGetContributions.mockReturnValue([
      {
        condition: () => true,
        component: ({ id }: { id?: string }) => (
          <div data-testid="task-panel">{`panel:${id}`}</div>
        ),
      },
    ]);

    render(
      <TaskOverview
        task={{ id: 't1', taskId: '1', status: 'Open' } as unknown as Task}
      />
    );

    expect(mockGetContributions).toHaveBeenCalledWith(
      EXTENSION_POINTS.INBOX_TASK_PANELS
    );
    expect(screen.getByTestId('task-panel')).toHaveTextContent('panel:t1');
  });

  it('skips a contributed panel whose condition does not match the task', () => {
    mockGetContributions.mockReturnValue([
      {
        condition: () => false,
        component: () => <div data-testid="task-panel" />,
      },
    ]);

    render(
      <TaskOverview
        task={
          {
            id: 't1',
            status: 'Open',
            description: 'Some description',
          } as unknown as Task
        }
      />
    );

    expect(screen.queryByTestId('task-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('desc-preview')).toBeInTheDocument();
  });

  it('renders a generic summary when no panel is contributed', () => {
    render(
      <TaskOverview
        task={
          {
            status: 'Open',
            assignees: [{ id: 'a', name: 'n', displayName: 'Assignee' }],
            description: 'Some description',
          } as unknown as Task
        }
      />
    );

    expect(screen.queryByTestId('task-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    // The status badge lives in the panel header, not in the overview rows.
    expect(screen.queryByText('label.status')).not.toBeInTheDocument();
  });

  it('renders the description through getFrontEndFormat at text-xs', () => {
    render(
      <TaskOverview
        task={
          {
            status: 'Open',
            description: 'Approval required for <#E::table::x>',
          } as unknown as Task
        }
      />
    );

    const preview = screen.getByTestId('desc-preview');

    // getFrontEndFormat resolves entity mentions before the markdown previewer.
    expect(preview).toHaveTextContent(
      'fmt:Approval required for <#E::table::x>'
    );
    expect(preview.className).toContain('text-xs');
  });

  it('renders assignees read-only with no edit affordance', () => {
    render(
      <TaskOverview
        task={
          {
            status: 'Open',
            assignees: [{ id: 'a', name: 'n', displayName: 'Assignee' }],
          } as unknown as Task
        }
      />
    );

    expect(screen.queryByTestId('edit-assignees')).not.toBeInTheDocument();
    expect(screen.queryByTestId('add-assignees')).not.toBeInTheDocument();
  });

  describe('resolution rows', () => {
    it('shows the resolver, date and rejection reason for a closed task', () => {
      render(
        <TaskOverview
          task={
            {
              status: 'Rejected',
              resolution: {
                type: 'Rejected',
                comment: 'testing',
                resolvedAt: 1786955635076,
                resolvedBy: { id: 'u1', name: 'harsh.vador' },
              },
            } as unknown as Task
          }
        />
      );

      expect(screen.getByText('label.resolved-by')).toBeInTheDocument();
      expect(screen.getByText('harsh.vador')).toBeInTheDocument();
      expect(screen.getByText('label.resolved-on')).toBeInTheDocument();
      expect(screen.getByText('date-1786955635076')).toBeInTheDocument();
      // A rejection's comment IS the reason, so it is labelled as one.
      expect(
        screen.getByText('label.reason-for-rejection')
      ).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });

    it('falls back to the no-data placeholder when a rejection carries no reason', () => {
      render(
        <TaskOverview
          task={
            {
              status: 'Rejected',
              resolution: { type: 'Rejected' },
            } as unknown as Task
          }
        />
      );

      expect(
        screen.getByText('label.reason-for-rejection')
      ).toBeInTheDocument();
      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('renders no resolution rows while the task is open', () => {
      render(<TaskOverview task={{ status: 'Open' } as unknown as Task} />);

      expect(screen.queryByText('label.resolved-by')).not.toBeInTheDocument();
      expect(screen.queryByText('label.resolved-on')).not.toBeInTheDocument();
      expect(
        screen.queryByText('label.reason-for-rejection')
      ).not.toBeInTheDocument();
    });
  });
});
