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
import { fireEvent, render, screen } from '@testing-library/react';
import React, { ReactNode } from 'react';
import ActivityFeed from './ActivityFeed';

const TABLE_LINK = '<#E::table::svc.db.schema.customers>';
const mockTaskCounts = { all: 4, open: 3, closed: 1 };

jest.mock('@openmetadata/ui-core-components', () => {
  const Tabs = ({
    children,
    onSelectionChange,
  }: {
    children?: ReactNode;
    onSelectionChange: (key: string) => void;
  }) => (
    <div>
      {children}
      <button onClick={() => onSelectionChange('tasks')}>pick-tasks</button>
    </div>
  );
  Tabs.List = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Tabs.Item = ({
    id,
    badge,
    children,
  }: {
    id: string;
    badge?: string | number;
    children: ReactNode;
  }) => (
    <span data-badge={badge} data-testid={`view-${id}`}>
      {children}
    </span>
  );

  return {
    Box: jest
      .requireActual('react')
      .forwardRef(
        (
          { children }: { children?: ReactNode },
          ref: React.Ref<HTMLDivElement>
        ) => <div ref={ref}>{children}</div>
      ),
    Tabs,
  };
});

// The two views have their own suites; here they report what they were given.
jest.mock('../../discovery/personal-space/InboxPage/tabs/ActivityTab', () => ({
  __esModule: true,
  default: ({ scope, leading }: { scope: unknown; leading: ReactNode }) => (
    <div data-scope={JSON.stringify(scope)} data-testid="activity-view">
      {leading}
    </div>
  ),
}));

jest.mock('./ActivityFeedTasks', () => ({
  __esModule: true,
  default: ({
    scope,
    leading,
    status,
    onStatusChange,
  }: {
    scope: unknown;
    leading: ReactNode;
    status: string;
    onStatusChange: (status: string) => void;
  }) => (
    <div
      data-scope={JSON.stringify(scope)}
      data-status={status}
      data-testid="tasks-view">
      {leading}
      <button onClick={() => onStatusChange('closed')}>pick-closed</button>
    </div>
  ),
}));

jest.mock('../../discovery/personal-space/InboxPage/useInboxActivity', () => ({
  useInboxActivity: () => ({
    items: [],
    total: 5,
    isCapped: false,
    isLoading: false,
  }),
}));

jest.mock('../../discovery/personal-space/InboxPage/useTaskQueue', () => ({
  useTaskStatusCounts: () => mockTaskCounts,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ActivityFeed', () => {
  beforeEach(() => {
    mockTaskCounts.open = 3;
  });

  it("opens on the entity's activity, with both counts on the switch", () => {
    render(<ActivityFeed entityLink={TABLE_LINK} />);

    expect(
      JSON.parse(
        screen.getByTestId('activity-view').getAttribute('data-scope') ?? ''
      )
    ).toEqual({ type: 'entity', entityLink: TABLE_LINK });
    expect(screen.getByTestId('view-activity')).toHaveAttribute(
      'data-badge',
      '5'
    );
    expect(screen.getByTestId('view-tasks')).toHaveAttribute('data-badge', '3');
  });

  it('switches to the tasks about the entity', () => {
    render(<ActivityFeed entityLink={TABLE_LINK} />);

    fireEvent.click(screen.getByText('pick-tasks'));

    expect(
      JSON.parse(
        screen.getByTestId('tasks-view').getAttribute('data-scope') ?? ''
      )
    ).toEqual({ type: 'entity', aboutEntity: 'svc.db.schema.customers' });
    expect(screen.queryByTestId('activity-view')).not.toBeInTheDocument();
  });

  it('reads a user link as what the user did and their tasks', () => {
    render(
      <ActivityFeed defaultView="tasks" entityLink="<#E::user::harsh.vador>" />
    );

    expect(
      JSON.parse(
        screen.getByTestId('tasks-view').getAttribute('data-scope') ?? ''
      )
    ).toEqual({ type: 'assignee', assignee: 'harsh.vador' });
  });

  // The badge counts the Status chosen in the Tasks view, kept across views.
  it('counts the chosen Status on the Tasks badge', () => {
    render(<ActivityFeed defaultView="tasks" entityLink={TABLE_LINK} />);

    expect(screen.getByTestId('tasks-view')).toHaveAttribute(
      'data-status',
      'open'
    );

    fireEvent.click(screen.getByText('pick-closed'));

    expect(screen.getByTestId('view-tasks')).toHaveAttribute('data-badge', '1');
    expect(screen.getByTestId('tasks-view')).toHaveAttribute(
      'data-status',
      'closed'
    );
  });

  // No open task is nothing to count, not a "0".
  it('drops the Tasks badge when nothing is open', () => {
    mockTaskCounts.open = 0;
    render(<ActivityFeed entityLink={TABLE_LINK} />);

    expect(screen.getByTestId('view-tasks')).not.toHaveAttribute('data-badge');
  });

  // A host that puts the view in its route controls it.
  it('follows a controlled view and reports a switch', () => {
    const onViewChange = jest.fn();
    render(
      <ActivityFeed
        entityLink={TABLE_LINK}
        view="activity"
        onViewChange={onViewChange}
      />
    );

    fireEvent.click(screen.getByText('pick-tasks'));

    expect(onViewChange).toHaveBeenCalledWith('tasks');
  });
});
