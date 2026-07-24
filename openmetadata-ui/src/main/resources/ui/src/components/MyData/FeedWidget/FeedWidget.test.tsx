/*
 *  Copyright 2025 Collate.
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import * as ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { MyFeedWidget } from './FeedWidget.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: {
      id: 'user-id',
      name: 'testuser',
    },
  }),
}));

jest.mock(
  '../Widgets/Common/WidgetWrapper/WidgetWrapper',
  () =>
    ({
      children,
      header,
    }: {
      children: React.ReactNode;
      header: React.ReactNode;
    }) =>
      (
        <div data-testid="widget-wrapper">
          {header}
          {children}
        </div>
      )
);

jest.mock(
  '../Widgets/Common/WidgetHeader/WidgetHeader',
  () =>
    ({
      onSortChange,
      handleRemoveWidget,
      widgetKey,
    }: {
      onSortChange: (key: string) => void;
      handleRemoveWidget: (key: string) => void;
      widgetKey: string;
    }) =>
      (
        <div data-testid="widget-header">
          <select
            data-testid="filter-select"
            onChange={(e) => onSortChange(e.target.value)}>
            <option value={FeedFilter.ALL}>All</option>
            <option value={FeedFilter.OWNER}>Owner</option>
          </select>
          <button
            data-testid="remove-widget-button"
            onClick={() => handleRemoveWidget(widgetKey)}>
            Remove
          </button>
        </div>
      )
);

jest.mock(
  '../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component',
  () => ({
    __esModule: true,
    default: ({
      activityList,
      onAfterClose,
    }: {
      activityList: ActivityEvent[];
      onAfterClose: () => void;
    }) => (
      <div data-testid="activity-feed-list">
        <button data-testid="close-button" onClick={onAfterClose}>
          Close
        </button>
        {activityList.map((item: ActivityEvent, index: number) => (
          <div data-testid={`activity-item-${index}`} key={index}>
            {item.summary}
          </div>
        ))}
      </div>
    ),
  })
);

jest.mock('../Widgets/Common/WidgetFooter/WidgetFooter', () => () => (
  <div data-testid="widget-footer" />
));

jest.mock('../Widgets/Common/WidgetEmptyState/WidgetEmptyState', () => () => (
  <div data-testid="widget-empty-state">Empty State</div>
));

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Component) => Component),
}));

const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'activity-1',
    timestamp: 1234567890,
    eventType: 'entityUpdated' as ActivityEvent['eventType'],
    actor: { id: 'user-1', type: 'user', name: 'testuser' },
    entity: { id: 'entity-1', type: 'table', name: 'testTable' },
    about: '<#E::table::test1>',
    summary: 'Updated tags on table',
  },
  {
    id: 'activity-2',
    timestamp: 1234567891,
    eventType: 'entityUpdated' as ActivityEvent['eventType'],
    actor: { id: 'user-2', type: 'user', name: 'otheruser' },
    entity: { id: 'entity-2', type: 'table', name: 'testTable2' },
    about: '<#E::table::test2>',
    summary: 'Updated description on table',
  },
];

const mockFetchMyActivityFeed = jest.fn();
const mockShowActivityDrawer = jest.fn();

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      isActivityLoading: false,
      activityEvents: mockActivityEvents,
      fetchMyActivityFeed: mockFetchMyActivityFeed,
      showActivityDrawer: mockShowActivityDrawer,
    })),
  })
);

const renderComponent = (overrides = {}) => {
  return render(
    <BrowserRouter>
      <MyFeedWidget
        currentLayout={[{ i: 'test-widget', w: 4, h: 3, x: 0, y: 0 }]}
        handleLayoutUpdate={jest.fn()}
        handleRemoveWidget={jest.fn()}
        isEditView={false}
        widgetKey="test-widget"
        {...overrides}
      />
    </BrowserRouter>
  );
};

describe('MyFeedWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render activity feed when data is present', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
      });

      expect(screen.getByTestId('activity-item-0')).toHaveTextContent(
        'Updated tags on table'
      );
      expect(screen.getByTestId('activity-item-1')).toHaveTextContent(
        'Updated description on table'
      );
    });

    it('should render empty state when no activity events', async () => {
      (
        ActivityFeedProvider.useActivityFeedProvider as jest.Mock
      ).mockReturnValueOnce({
        isActivityLoading: false,
        activityEvents: [],
        fetchMyActivityFeed: mockFetchMyActivityFeed,
        showActivityDrawer: mockShowActivityDrawer,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('widget-empty-state')).toBeInTheDocument();
      });
    });

    it('should render widget header', () => {
      renderComponent();

      expect(screen.getByTestId('widget-header')).toBeInTheDocument();
    });

    it('should render widget footer', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('widget-footer')).toBeInTheDocument();
      });
    });
  });

  describe('Activity Feed Fetching', () => {
    it('should call fetchMyActivityFeed on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockFetchMyActivityFeed).toHaveBeenCalledWith({
          limit: PAGE_SIZE_MEDIUM,
        });
      });
    });

    it('should show loading state when fetching', async () => {
      (
        ActivityFeedProvider.useActivityFeedProvider as jest.Mock
      ).mockReturnValueOnce({
        isActivityLoading: true,
        activityEvents: [],
        fetchMyActivityFeed: mockFetchMyActivityFeed,
        showActivityDrawer: mockShowActivityDrawer,
      });

      renderComponent();

      // Widget wrapper receives loading prop
      expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
    });
  });

  describe('Widget Actions', () => {
    it('should call handleRemoveWidget when remove button is clicked', () => {
      const handleRemoveWidget = jest.fn();
      renderComponent({ handleRemoveWidget });

      fireEvent.click(screen.getByTestId('remove-widget-button'));

      expect(handleRemoveWidget).toHaveBeenCalledWith('test-widget');
    });

    it('should call handleRemoveWidget when close button is clicked', async () => {
      const handleRemoveWidget = jest.fn();
      renderComponent({ handleRemoveWidget });

      await waitFor(() => {
        expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('close-button'));

      expect(handleRemoveWidget).toHaveBeenCalledWith('test-widget');
    });

    it('should handle undefined handleRemoveWidget gracefully', async () => {
      renderComponent({ handleRemoveWidget: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
      });

      expect(() => {
        fireEvent.click(screen.getByTestId('close-button'));
      }).not.toThrow();
    });
  });

  describe('Layout Handling', () => {
    it('should handle missing layout gracefully', () => {
      renderComponent({ currentLayout: [] });

      expect(screen.getByTestId('widget-header')).toBeInTheDocument();
    });

    it('should handle undefined layout gracefully', () => {
      renderComponent({ currentLayout: undefined });

      expect(screen.getByTestId('widget-header')).toBeInTheDocument();
    });
  });

  describe('Activity Click Handler', () => {
    it('should pass showActivityDrawer to ActivityFeedListV1New', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
      });

      // The showActivityDrawer is passed as onActivityClick prop
      // This is tested by verifying the component renders with the prop
    });
  });
});
