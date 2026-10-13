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
import { EntityType } from '../../../../enums/entity.enum';
import { getRecentlyViewedData } from '../../../../utils/RecentActivityUtils';
import RecentlyViewedCarousel from './RecentlyViewedCarousel';

jest.mock('../../../../utils/RecentActivityUtils', () => ({
  getRecentlyViewedData: jest.fn(),
}));

jest.mock('../../../../utils/ServiceUtilClassBase');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockGetRecentlyViewedData = getRecentlyViewedData as jest.Mock;

const buildEntities = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    displayName: `Table ${index + 1}`,
    entityType: EntityType.TABLE,
    fqn: `svc.db.schema.table_${index + 1}`,
    serviceType: 'Mysql',
    timestamp: index,
  }));

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  });
};

const getVisibleAssets = () =>
  screen
    .getAllByTestId('recently-viewed-asset')
    .filter((asset) => asset.getAttribute('aria-hidden') === 'false');

describe('RecentlyViewedCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewportWidth(1024);
  });

  it('renders nothing when there is no recently viewed data', () => {
    mockGetRecentlyViewedData.mockReturnValue([]);

    const { container } = render(<RecentlyViewedCarousel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('hides arrows and dots when every item fits on one page', () => {
    mockGetRecentlyViewedData.mockReturnValue(buildEntities(3));

    render(<RecentlyViewedCarousel />);

    expect(getVisibleAssets()).toHaveLength(3);
    expect(
      screen.queryByTestId('recently-viewed-next')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('recently-viewed-dot')).not.toBeInTheDocument();
  });

  it('pages through items with the arrows', () => {
    mockGetRecentlyViewedData.mockReturnValue(buildEntities(6));

    render(<RecentlyViewedCarousel />);

    const prev = screen.getByTestId('recently-viewed-prev');
    const next = screen.getByTestId('recently-viewed-next');

    expect(screen.getAllByTestId('recently-viewed-dot')).toHaveLength(2);
    expect(prev).toBeDisabled();
    expect(getVisibleAssets().map((asset) => asset.textContent)).toEqual([
      'Table 1',
      'Table 2',
      'Table 3',
      'Table 4',
    ]);

    fireEvent.click(next);

    expect(next).toBeDisabled();
    expect(prev).toBeEnabled();
    expect(getVisibleAssets().map((asset) => asset.textContent)).toEqual([
      'Table 5',
      'Table 6',
    ]);

    fireEvent.click(prev);

    expect(getVisibleAssets()[0]).toHaveTextContent('Table 1');
  });

  it('jumps to a page when its dot is clicked', () => {
    mockGetRecentlyViewedData.mockReturnValue(buildEntities(9));

    render(<RecentlyViewedCarousel />);

    const dots = screen.getAllByTestId('recently-viewed-dot');

    expect(dots).toHaveLength(3);

    fireEvent.click(dots[2]);

    expect(getVisibleAssets().map((asset) => asset.textContent)).toEqual([
      'Table 9',
    ]);
    expect(screen.getByTestId('recently-viewed-next')).toBeDisabled();
  });

  it('shows more items per page on wider viewports', () => {
    setViewportWidth(2000);
    mockGetRecentlyViewedData.mockReturnValue(buildEntities(9));

    render(<RecentlyViewedCarousel />);

    expect(getVisibleAssets()).toHaveLength(9);
    expect(screen.queryByTestId('recently-viewed-dot')).not.toBeInTheDocument();

    act(() => {
      setViewportWidth(1024);
      window.dispatchEvent(new Event('resize'));
    });

    expect(getVisibleAssets()).toHaveLength(4);
    expect(screen.getAllByTestId('recently-viewed-dot')).toHaveLength(3);
  });

  it('navigates to the entity on click and keyboard activation', () => {
    mockGetRecentlyViewedData.mockReturnValue(buildEntities(1));

    render(<RecentlyViewedCarousel />);

    const asset = screen.getByRole('button', { name: 'Table 1' });
    fireEvent.click(asset);
    fireEvent.keyDown(asset, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('svc.db.schema.table_1')
    );
  });

  it('removes off-page items from the tab order', () => {
    mockGetRecentlyViewedData.mockReturnValue(buildEntities(5));

    render(<RecentlyViewedCarousel />);

    const assets = screen.getAllByTestId('recently-viewed-asset');

    expect(assets[0]).toHaveAttribute('tabindex', '0');
    expect(assets[4]).toHaveAttribute('tabindex', '-1');
  });
});
