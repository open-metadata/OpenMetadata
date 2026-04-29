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
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import TourPage from './TourPage.component';

const mockUseTourProvider = {
  updateIsTourOpen: jest.fn(),
  currentTourPage: CurrentTourPageType.MY_DATA_PAGE,
  updateActiveTab: jest.fn(),
  updateTourPage: jest.fn(),
  updateTourSearch: jest.fn(),
};

const mockQuerySelector = jest.fn();
Object.defineProperty(document, 'querySelector', {
  value: mockQuerySelector,
  writable: true,
});

const createReadyFeedWidget = () => {
  const feedWidget = document.createElement('div');
  jest.spyOn(feedWidget, 'getBoundingClientRect').mockReturnValue({
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: jest.fn(),
  });

  return feedWidget;
};

const waitForTourReadyCheck = async (time = 16) => {
  await act(async () => {
    jest.advanceTimersByTime(time);
  });
};

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockImplementation(() => mockUseTourProvider),
}));
jest.mock('../../components/AppTour/Tour', () => {
  return jest.fn().mockImplementation(({ steps }) => (
    <div>
      Tour.component{' '}
      <button data-testid="clear-btn" onClick={steps.clearSearchTerm}>
        clear
      </button>
    </div>
  ));
});
jest.mock('../MyDataPage/MyDataPage.component', () => {
  return jest.fn().mockImplementation(() => <div>MyDataPage.component</div>);
});
jest.mock('../ExplorePage/ExplorePageV1.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>ExplorePageV1Component.component</div>);
});
jest.mock('../TableDetailsPageV1/TableDetailsPageV1', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>TableDetailsPageV1.component</div>);
});
jest.mock('../../utils/TourUtils', () => ({
  getTourSteps: jest.fn().mockImplementation((props) => props),
}));

describe('TourPage component', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    const feedWidget = createReadyFeedWidget();
    mockQuerySelector.mockImplementation((selector) => {
      if (selector === '#feedWidgetData') {
        return feedWidget;
      }

      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should render correctly', async () => {
    render(<TourPage />);
    await waitForTourReadyCheck();

    expect(await screen.findByText('Tour.component')).toBeInTheDocument();
  });

  it('clear search term should work correctly', async () => {
    render(<TourPage />);
    await waitForTourReadyCheck();

    const clearBtn = await screen.findByTestId('clear-btn');
    fireEvent.click(clearBtn);

    expect(mockUseTourProvider.updateTourSearch).toHaveBeenCalledWith('');
  });

  it('should render tour when feed widget appears after initial render', async () => {
    const feedWidget = createReadyFeedWidget();
    mockQuerySelector.mockReturnValue(null);

    render(<TourPage />);

    expect(screen.queryByText('Tour.component')).not.toBeInTheDocument();

    mockQuerySelector.mockImplementation((selector) => {
      if (selector === '#feedWidgetData') {
        return feedWidget;
      }

      return null;
    });
    await act(async () => {
      document.body.appendChild(feedWidget);
    });
    await waitForTourReadyCheck(116);

    expect(screen.getByText('Tour.component')).toBeInTheDocument();

    feedWidget.remove();
  });

  it('should render tour when existing feed widget becomes layout ready', async () => {
    const feedWidget = document.createElement('div');
    const getBoundingClientRect = jest
      .spyOn(feedWidget, 'getBoundingClientRect')
      .mockReturnValueOnce({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: jest.fn(),
      })
      .mockReturnValue({
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: jest.fn(),
      });

    mockQuerySelector.mockImplementation((selector) => {
      if (selector === '#feedWidgetData') {
        return feedWidget;
      }

      return null;
    });

    render(<TourPage />);

    expect(screen.queryByText('Tour.component')).not.toBeInTheDocument();

    await waitForTourReadyCheck();

    expect(screen.getByText('Tour.component')).toBeInTheDocument();
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it('MyDataPage Component should be visible, if currentTourPage is myDataPage', async () => {
    (useTourProvider as jest.Mock).mockReset();
    (useTourProvider as jest.Mock).mockImplementation(() => ({
      ...mockUseTourProvider,
      currentTourPage: CurrentTourPageType.MY_DATA_PAGE,
    }));
    render(<TourPage />);
    await waitForTourReadyCheck();

    expect(await screen.findByText('MyDataPage.component')).toBeInTheDocument();
  });

  it('ExplorePage Component should be visible, if currentTourPage is explorePage', async () => {
    (useTourProvider as jest.Mock).mockReset();
    (useTourProvider as jest.Mock).mockImplementation(() => ({
      ...mockUseTourProvider,
      currentTourPage: CurrentTourPageType.EXPLORE_PAGE,
    }));
    render(<TourPage />);
    await waitForTourReadyCheck();

    expect(
      await screen.findByText('ExplorePageV1Component.component')
    ).toBeInTheDocument();
  });

  it('TableDetailsPage Component should be visible, if currentTourPage is datasetPage', async () => {
    (useTourProvider as jest.Mock).mockReset();
    (useTourProvider as jest.Mock).mockImplementation(() => ({
      ...mockUseTourProvider,
      currentTourPage: CurrentTourPageType.DATASET_PAGE,
    }));
    render(<TourPage />);
    await waitForTourReadyCheck();

    expect(
      await screen.findByText('TableDetailsPageV1.component')
    ).toBeInTheDocument();
  });
});
