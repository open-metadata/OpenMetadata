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
/*
 *  Copyright 2023 Collate.
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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { getAllFeeds } from '../../../rest/feedsAPI';
import * as ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { MyFeedWidget } from './FeedWidget.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  getAllFeeds: jest.fn().mockImplementation(() => ({
    data: [
      {
        id: '1',
        message: 'First post',
        threadTs: 111,
        type: ThreadType.Conversation,
      },
      {
        id: '2',
        message: 'Second post',
        threadTs: 222,
        type: ThreadType.Conversation,
      },
    ],
  })),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getFeedListWithRelativeDays: (data: any) => ({
    updatedFeedList: data,
  }),
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
    ({ children, header }: any) =>
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
    ({ onSortChange, handleRemoveWidget, widgetKey }: any) =>
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
    default: ({ feedList, onAfterClose }: any) => (
      <div data-testid="activity-feed-list">
        <button data-testid="close-button" onClick={onAfterClose}>
          Close
        </button>
        {feedList.map((item: any, index: number) => (
          <div data-testid={`feed-item-${index}`} key={index}>
            {item.message}
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

// Create a mock getFeedData function that can be tracked
const mockGetFeedData = jest.fn();

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockImplementation(() => ({
      loading: false,
      entityThread: [
        {
          id: '1',
          message: 'First post',
          threadTs: 111,
          type: ThreadType.Conversation,
        },
        {
          id: '2',
          message: 'Second post',
          threadTs: 222,
          type: ThreadType.Conversation,
        },
      ],
      getFeedData: mockGetFeedData,
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

  it('should render activity feed when data is present', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('feed-item-0')).toHaveTextContent('First post');
    expect(screen.getByTestId('feed-item-1')).toHaveTextContent('Second post');
  });

  it('should render empty state when no data is returned', async () => {
    // Mock provider to return empty data
    (
      ActivityFeedProvider.useActivityFeedProvider as jest.Mock
    ).mockReturnValueOnce({
      loading: false,
      entityThread: [],
      getFeedData: mockGetFeedData,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('widget-empty-state')).toBeInTheDocument();
    });
  });

  it('should trigger filter change and fetch data accordingly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockGetFeedData).toHaveBeenCalledWith(
        FeedFilter.ALL,
        undefined,
        ThreadType.Conversation,
        undefined,
        undefined,
        undefined,
        PAGE_SIZE_MEDIUM
      );
    });

    (getAllFeeds as jest.Mock).mockResolvedValueOnce({ data: [] });

    await act(async () => {
      fireEvent.change(screen.getByTestId('filter-select'), {
        target: { value: FeedFilter.OWNER },
      });
    });

    await waitFor(() => {
      expect(mockGetFeedData).toHaveBeenCalledWith(
        FeedFilter.OWNER,
        undefined,
        ThreadType.Conversation,
        undefined,
        undefined,
        undefined,
        PAGE_SIZE_MEDIUM
      );
    });
  });

  it('should call handleRemoveWidget when remove button is clicked', () => {
    const handleRemoveWidget = jest.fn();
    renderComponent({ handleRemoveWidget });

    fireEvent.click(screen.getByTestId('remove-widget-button'));

    expect(handleRemoveWidget).toHaveBeenCalledWith('test-widget');
  });

  it('should handle close button click from feed list', async () => {
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

    fireEvent.click(screen.getByTestId('close-button'));

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should show footer', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('widget-footer')).toBeInTheDocument();
    });
  });

  it('should render widget header', () => {
    renderComponent();

    expect(screen.getByTestId('widget-header')).toBeInTheDocument();
  });

  it('should handle missing layout gracefully', () => {
    renderComponent({ currentLayout: [] });

    expect(screen.getByTestId('widget-header')).toBeInTheDocument();
  });
});
