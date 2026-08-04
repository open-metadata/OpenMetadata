/*
 *  Copyright 2024 Collate.
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
import { FeedFilter } from '../../../enums/mydata.enum';
import { ActivityFeedTabs } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import FeedsFilterPopover from './FeedsFilterPopover.component';

const FILTER_BUTTON = 'filter-button';
const CANCEL_BUTTON = 'cancel-button';

const onUpdateMock = jest.fn();
const mockProps = {
  feedTab: ActivityFeedTabs.ALL,
  defaultFilter: FeedFilter.ALL,
  onUpdate: onUpdateMock,
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: {
      isAdmin: true,
    },
  })),
}));

describe('FeedsFilterPopover', () => {
  it('should render Feeds Filter Popover', async () => {
    await act(async () => {
      render(<FeedsFilterPopover {...mockProps} />);
    });

    const filterButton = screen.getByTestId(FILTER_BUTTON);
    fireEvent.click(
      filterButton,
      new MouseEvent('hover', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(screen.getByTestId(CANCEL_BUTTON)).toBeInTheDocument();
    expect(
      screen.getByTestId('selectable-list-update-btn')
    ).toBeInTheDocument();
  });

  it('should update filter when an item is clicked', async () => {
    await act(async () => {
      render(<FeedsFilterPopover {...mockProps} />);
    });

    const filterButton = screen.getByTestId(FILTER_BUTTON);
    fireEvent.click(
      filterButton,
      new MouseEvent('hover', {
        bubbles: true,
        cancelable: true,
      })
    );
    const listItem = screen.getByText('message.feed-filter-all');
    fireEvent.click(listItem);
    fireEvent.click(screen.getByTestId('selectable-list-update-btn'));

    expect(onUpdateMock).toHaveBeenCalledWith(FeedFilter.ALL);
  });

  it('should close popover when cancel button is clicked', async () => {
    await act(async () => {
      render(<FeedsFilterPopover {...mockProps} />);
    });

    const filterButton = screen.getByTestId(FILTER_BUTTON);
    fireEvent.click(
      filterButton,
      new MouseEvent('hover', {
        bubbles: true,
        cancelable: true,
      })
    );
    const cancelButton = screen.getByTestId(CANCEL_BUTTON);
    fireEvent.click(cancelButton);

    expect(screen.queryByTestId(CANCEL_BUTTON)).not.toBeInTheDocument();
  });
});
