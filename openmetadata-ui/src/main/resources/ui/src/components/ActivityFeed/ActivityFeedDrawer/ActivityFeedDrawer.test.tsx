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
import ActivityFeedDrawer from './ActivityFeedDrawer';

const mockHideDrawer = jest.fn();
const mockProvider = jest.fn();

jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => mockProvider(),
}));

jest.mock('../ActivityFeedPanel/FeedPanelHeader', () =>
  jest.fn(({ onCancel }) => (
    <button data-testid="closeDrawer" onClick={onCancel}>
      header
    </button>
  ))
);

jest.mock('../ActivityFeedPanel/FeedPanelBodyV1', () =>
  jest.fn(() => <div data-testid="feed-panel-body" />)
);

jest.mock('../ActivityFeedPanel/ActivityPanelHeader', () =>
  jest.fn(() => <div data-testid="activity-panel-header" />)
);

jest.mock('../ActivityFeedPanel/ActivityPanelBody', () =>
  jest.fn(() => <div data-testid="activity-panel-body" />)
);

jest.mock('../ActivityFeedPanel/TaskPanelHeader', () =>
  jest.fn(() => <div data-testid="task-panel-header" />)
);

jest.mock('../../Entity/Task/TaskTab/TaskTabNew.component', () => ({
  TaskTabNew: jest.fn(() => <div data-testid="task-tab" />),
}));

const thread = { id: 'thread-1', about: '<#E::table::a.b>' };

describe('ActivityFeedDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider.mockReturnValue({
      hideDrawer: mockHideDrawer,
      selectedThread: thread,
    });
  });

  it('renders nothing without a selected thread, task or activity', () => {
    mockProvider.mockReturnValue({ hideDrawer: mockHideDrawer });

    render(<ActivityFeedDrawer open />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the thread header and body in the drawer panel', () => {
    render(<ActivityFeedDrawer open />);

    const dialog = screen.getByRole('dialog');

    expect(screen.getByTestId('activity-feed-drawer')).toContainElement(dialog);
    expect(screen.getByTestId('closeDrawer')).toBeInTheDocument();
    expect(dialog.querySelector('#feed-panel')).toContainElement(
      screen.getByTestId('feed-panel-body')
    );
  });

  it('renders the activity panel when an activity is selected', () => {
    mockProvider.mockReturnValue({
      hideDrawer: mockHideDrawer,
      selectedActivity: { id: 'activity-1' },
    });

    render(<ActivityFeedDrawer open />);

    expect(screen.getByTestId('activity-panel-header')).toBeInTheDocument();
    expect(screen.getByTestId('activity-panel-body')).toBeInTheDocument();
  });

  it('renders the task panel when a task is selected', async () => {
    mockProvider.mockReturnValue({
      hideDrawer: mockHideDrawer,
      selectedTask: { id: 'task-1', about: { type: 'table' } },
    });

    render(<ActivityFeedDrawer open />);

    expect(screen.getByTestId('task-panel-header')).toBeInTheDocument();
    expect(await screen.findByTestId('task-tab')).toBeInTheDocument();
  });

  it('hides the drawer on Escape', () => {
    render(<ActivityFeedDrawer open />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(mockHideDrawer).toHaveBeenCalled();
  });

  it('hides the drawer from the header close action', () => {
    render(<ActivityFeedDrawer open />);

    fireEvent.click(screen.getByTestId('closeDrawer'));

    expect(mockHideDrawer).toHaveBeenCalled();
  });
});
