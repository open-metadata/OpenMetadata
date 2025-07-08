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
import RecentlyViewed from './RecentlyViewed';

const mockProp = {
  widgetKey: 'testKey',
};

jest.mock(
  '../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
  () => {
    return jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>);
  }
);
jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '' }));
});

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getRecentlyViewedData: jest.fn().mockReturnValue([
    {
      displayName: 'test',
      entityType: 'table',
      fqn: 'test',
      id: '1',
      serviceType: 'BigQuery',
      name: 'Test Item',
      fullyQualifiedName: 'test.item',
      type: 'test',
      timestamp: 1706533046620,
    },
  ]),
  prepareLabel: jest.fn(),
}));

describe('RecentlyViewed', () => {
  it('should render RecentlyViewed', async () => {
    await act(async () => {
      render(<RecentlyViewed widgetKey={mockProp.widgetKey} />);
    });

    expect(screen.getByTestId('recently-viewed-widget')).toBeInTheDocument();
  });

  it('should call handleCloseClick when close button is clicked', async () => {
    const handleRemoveWidget = jest.fn();
    const { getByTestId } = render(
      <RecentlyViewed
        isEditView
        handleRemoveWidget={handleRemoveWidget}
        widgetKey="testKey"
      />
    );
    fireEvent.click(getByTestId('remove-widget-button'));

    expect(handleRemoveWidget).toHaveBeenCalled();
  });

  it('renders list item when data is not empty', async () => {
    await act(async () => {
      render(<RecentlyViewed widgetKey={mockProp.widgetKey} />);
    });

    expect(screen.getByTestId('Recently Viewed-test')).toBeInTheDocument();
  });
});
