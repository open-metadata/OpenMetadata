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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import type { InboxDateRange } from './inbox.utils';

let mockActivityCount = { total: 5, isCapped: false };

jest.mock('./useInboxCounts', () => ({
  useInboxCounts: () => ({
    activityCount: mockActivityCount,
    taskCount: 2,
    isLoading: false,
  }),
}));

interface CapturedActivityTabProps {
  dateRange?: InboxDateRange;
  isFiltered?: boolean;
  onDatePresetChange: (key: string) => void;
}

let mockActivityTabProps: CapturedActivityTabProps;

// The Activity toolbar owns the date filter; the shell holds the window.
jest.mock('./tabs/ActivityTab', () => ({
  __esModule: true,
  default: (props: CapturedActivityTabProps) => {
    mockActivityTabProps = props;

    return <div data-testid="activity" />;
  },
}));

jest.mock('./tabs/TasksTab', () => ({
  __esModule: true,
  default: () => <div data-testid="tasks" />,
}));

// The shell is presentational; render its two slots so the tabs and the active
// surface this component supplies stay observable.
jest.mock('./InboxPage', () => ({
  __esModule: true,
  default: ({ tabs, content }: { tabs?: ReactNode; content?: ReactNode }) => (
    <div>
      {tabs}
      {content}
    </div>
  ),
}));

let tabsOnChange: ((key: string) => void) | undefined;
let tabsSelectedKey: string | undefined;

jest.mock('@openmetadata/ui-core-components', () => {
  const TabsRoot = ({
    selectedKey,
    onSelectionChange,
    children,
  }: {
    selectedKey?: string;
    onSelectionChange?: (...args: unknown[]) => void;
    children?: ReactNode;
  }) => {
    tabsOnChange = onSelectionChange;
    tabsSelectedKey = selectedKey;

    return <div>{children}</div>;
  };
  const TabsList = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const TabsItem = ({
    id,
    children,
  }: {
    id: string;
    children: (state: { isSelected: boolean }) => ReactNode;
  }) => (
    <button
      data-testid={`tab-${id}`}
      type="button"
      onClick={() => tabsOnChange?.(id)}>
      {children({ isSelected: id === tabsSelectedKey })}
    </button>
  );

  const Tabs = Object.assign(TabsRoot, { List: TabsList, Item: TabsItem });

  return {
    Badge: ({ children, color }: { children?: ReactNode; color?: string }) => (
      <span data-color={color} data-testid="tab-count">
        {`:${children}`}
      </span>
    ),
    Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Tabs,
  };
});

jest.mock('constants/profiler.constant', () => ({
  PROFILER_FILTER_RANGE: {
    last7days: { days: 7 },
    last30days: { days: 30 },
  },
}));

jest.mock('utils/date-time/DateTimeUtils', () => ({
  getStartOfDayInMillis: (value: number) => value ?? 0,
  getEndOfDayInMillis: (value: number) => value ?? 0,
  getEpochMillisForPastDays: (days: number) => days,
  getCurrentMillis: () => 0,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mockPathname = '/inbox';
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
}));

import InboxContent from './InboxContent';

describe('InboxContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/inbox';
    mockActivityCount = { total: 5, isCapped: false };
  });

  it('renders the Activity tab by default', () => {
    render(<InboxContent />);

    expect(screen.getByTestId('activity')).toBeInTheDocument();
  });

  it('navigates to the Tasks route when the Tasks tab is selected', () => {
    render(<InboxContent />);

    fireEvent.click(screen.getByTestId('tab-tasks'));

    expect(mockNavigate).toHaveBeenCalledWith('/inbox/tasks');
  });

  it('renders the Tasks tab when the path is the Tasks route', () => {
    mockPathname = '/inbox/tasks';
    render(<InboxContent />);

    expect(screen.getByTestId('tasks')).toBeInTheDocument();
  });

  it('navigates to the Activity route when the Activity tab is selected', () => {
    mockPathname = '/inbox/tasks';
    render(<InboxContent />);

    fireEvent.click(screen.getByTestId('tab-activity'));

    expect(mockNavigate).toHaveBeenCalledWith('/inbox/activity');
  });

  it('renders the Activity tab when the path is the Activity route', () => {
    mockPathname = '/inbox/activity';
    render(<InboxContent />);

    expect(screen.getByTestId('activity')).toBeInTheDocument();
  });

  it('shows the activity and task counts on the tab badges', () => {
    render(<InboxContent />);

    expect(screen.getByTestId('tab-activity')).toHaveTextContent(
      'label.activity:5'
    );
    expect(screen.getByTestId('tab-tasks')).toHaveTextContent('label.triage:2');
  });

  // The activity lists are capped, so a full page reads as a floor.
  it('caps a full activity count at 99+', () => {
    mockActivityCount = { total: 300, isCapped: true };
    render(<InboxContent />);

    expect(screen.getByTestId('tab-activity')).toHaveTextContent(
      'label.activity:99+'
    );
  });

  // The selected tab's count is brand-tinted; the other stays gray.
  it('tints the selected tab count', () => {
    mockPathname = '/inbox/tasks';
    render(<InboxContent />);

    const [activityCount, tasksCount] = screen.getAllByTestId('tab-count');

    expect(activityCount).toHaveAttribute('data-color', 'gray');
    expect(tasksCount).toHaveAttribute('data-color', 'brand');
  });

  it('starts on the default window, unfiltered', () => {
    render(<InboxContent />);

    expect(mockActivityTabProps.dateRange?.key).toBe('last30days');
    expect(mockActivityTabProps.isFiltered).toBe(false);
  });

  it('narrows the window to the preset the toolbar picks', () => {
    render(<InboxContent />);

    act(() => {
      mockActivityTabProps.onDatePresetChange('last7days');
    });

    expect(mockActivityTabProps.dateRange).toEqual(
      expect.objectContaining({ key: 'last7days' })
    );
    expect(mockActivityTabProps.isFiltered).toBe(true);
  });
});
