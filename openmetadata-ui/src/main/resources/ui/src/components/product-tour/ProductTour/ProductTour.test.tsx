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
import { act, render, screen } from '@testing-library/react';
import ProductTour from './ProductTour';
import {
  getTourTarget,
  leaveTour,
  releaseTourPageLock,
  runInViewTransition,
  waitForStableTarget,
} from './ProductTour.utils';

const mockNavigate = jest.fn();
const mockLocation = { pathname: '/', search: '' };
const mockTourState = {
  isActive: true,
  isEndModalOpen: false,
  stepIndex: 0,
  tourMode: 'default',
  goToStep: jest.fn(),
  finish: jest.fn(),
  exit: jest.fn(),
  restoreModeHint: jest.fn(),
  isBeforeTour: jest.fn(() => false),
};
let mockTutorialProps: Record<string, unknown> = {};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

jest.mock('../../../hooks/product-tour/useProductTourStore', () => ({
  useProductTourStore: Object.assign(() => mockTourState, {
    getState: () => mockTourState,
  }),
}));

jest.mock(
  '../ProductTourPathRecorder/ProductTourPathRecorder',
  () => () => null
);
jest.mock('../ProductTourStepContent/ProductTourStepContent', () => () => null);

jest.mock('./ProductTour.utils', () => ({
  focusTourNextButton: jest.fn(),
  getTourTarget: jest.fn((selector: string) => selector),
  leaveTour: jest.fn(),
  releaseTourPageLock: jest.fn(),
  runInViewTransition: jest.fn((update: () => void) => update()),
  scrollTargetIntoView: jest.fn(),
  waitForStableTarget: jest.fn(() => jest.fn()),
}));

jest.mock('../../../utils/ProductTourClassBase', () => ({
  getTour: () => ({
    mode: 'default',
    steps: [
      {
        route: '/',
        selector: '#home',
        i18nKey: 'message.product-tour-step-topics-to-catch-up-on',
        labelKey: 'label.topics-to-catch-up-on',
        position: 'right',
      },
      {
        route: '/glossary',
        selector: '#governance',
        i18nKey: 'message.product-tour-step-glossary',
        labelKey: 'label.glossary',
      },
    ],
    loadFixtures: async () => [],
  }),
  getPageSelector: () => '#page',
}));

jest.mock('@deuex-solutions/react-tour', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTutorialProps = props;

    return <div data-testid="react-tour" />;
  },
}));

const mockPreloadPages = jest.fn(async (_mode: string) => undefined);
jest.mock('../../AppRouter/ProductTourPagesClassBase', () => ({
  preloadPages: (mode: string) => mockPreloadPages(mode),
}));
jest.mock('../../../rest/product-tour/productTourMock', () => ({
  isTourPageQuiet: () => true,
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ theme: { primaryColor: '#000' } }),
}));

const waitForStableTargetMock = waitForStableTarget as jest.Mock;

type TourStep = {
  selector: string;
  position?: string;
  beforeStep: () => void;
  beforeNext?: () => void;
};

const showTutorial = async () => {
  const [, onReady] = waitForStableTargetMock.mock.calls.at(-1);
  await act(async () => onReady());
  await screen.findByTestId('react-tour');
};

describe('ProductTour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.pathname = '/';
    mockTourState.isActive = true;
    mockTourState.isEndModalOpen = false;
    mockTourState.stepIndex = 0;
    mockTutorialProps = {};
  });

  it('navigates to a step once, even when its page redirects on arrival', () => {
    mockTourState.stepIndex = 1;
    const { rerender } = render(<ProductTour />);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/glossary', { replace: false });

    // A bare /glossary opens its first glossary.
    mockLocation.pathname = '/glossary/first-glossary';
    rerender(<ProductTour />);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(waitForStableTargetMock).toHaveBeenCalledWith(
      '#governance:not([inert] *)',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('loads the code of the pages the tour visits as it starts', () => {
    render(<ProductTour />);

    expect(mockPreloadPages).toHaveBeenCalledWith('default');
  });

  it('replaces /tour with the first step, so Back leaves the tour', () => {
    mockLocation.pathname = '/tour';
    render(<ProductTour />);

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('holds the mask while the next page settles', async () => {
    render(<ProductTour />);

    expect(screen.getByTestId('tour-step-loading')).toBeInTheDocument();
    expect(
      document.documentElement.hasAttribute('data-product-tour-pending')
    ).toBe(true);

    await showTutorial();

    expect(screen.queryByTestId('tour-step-loading')).not.toBeInTheDocument();
    expect(
      document.documentElement.hasAttribute('data-product-tour-pending')
    ).toBe(false);
  });

  it('releases the page lock once the tour stops showing', async () => {
    const { rerender } = render(<ProductTour />);
    await showTutorial();

    expect(releaseTourPageLock).not.toHaveBeenCalled();

    mockTourState.isActive = false;
    rerender(<ProductTour />);

    expect(screen.queryByTestId('react-tour')).not.toBeInTheDocument();
    expect(releaseTourPageLock).toHaveBeenCalledTimes(1);
  });

  it('points a step whose target is gone at the page', async () => {
    render(<ProductTour />);
    await showTutorial();
    (getTourTarget as jest.Mock).mockReturnValueOnce('#page');
    const [step] = mockTutorialProps.steps as TourStep[];

    step.beforeStep();

    expect(getTourTarget).toHaveBeenCalledWith('#home:not([inert] *)', '#page');
    expect(step).toMatchObject({ selector: '#page', position: undefined });
    expect(
      document.documentElement.hasAttribute('data-product-tour-fallback')
    ).toBe(true);

    step.beforeStep();

    expect(
      document.documentElement.hasAttribute('data-product-tour-fallback')
    ).toBe(false);
  });

  it('moves to a step on another page inside a view transition', async () => {
    render(<ProductTour />);
    await showTutorial();
    const [step] = mockTutorialProps.steps as TourStep[];

    step.beforeNext?.();

    expect(runInViewTransition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Promise)
    );
    expect(mockTourState.goToStep).toHaveBeenCalledWith(1);
  });

  it('follows the browser Back button to the page it lands on', () => {
    mockTourState.stepIndex = 1;
    mockLocation.pathname = '/glossary';
    render(<ProductTour />);
    window.history.pushState({}, '', '/');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(mockTourState.goToStep).toHaveBeenCalledWith(0);
    expect(mockTourState.exit).not.toHaveBeenCalled();
  });

  it('ends the tour, reloading, when Back lands on a page that is not on it', () => {
    render(<ProductTour />);
    window.history.pushState({}, '', '/settings');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(mockTourState.exit).toHaveBeenCalledTimes(1);
    expect(leaveTour).toHaveBeenCalledWith();
  });

  it('ends the tour when Back lands before it started, even on a tour page', () => {
    mockTourState.stepIndex = 1;
    mockLocation.pathname = '/glossary';
    mockTourState.isBeforeTour.mockReturnValueOnce(true);
    render(<ProductTour />);
    window.history.pushState({}, '', '/');

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(mockTourState.exit).toHaveBeenCalledTimes(1);
    expect(mockTourState.goToStep).not.toHaveBeenCalled();
  });

  it('closes once, reloading where the tour started, though both close callbacks fire', async () => {
    render(<ProductTour />);
    await showTutorial();
    mockTourState.exit.mockImplementationOnce(() => {
      mockTourState.isActive = false;

      return '/explore';
    });

    act(() => {
      (mockTutorialProps.onRequestClose as () => void)();
      (mockTutorialProps.onRequestSkip as () => void)();
    });

    expect(mockTourState.exit).toHaveBeenCalledTimes(1);
    expect(leaveTour).toHaveBeenCalledTimes(1);
    expect(leaveTour).toHaveBeenCalledWith('/explore');
  });

  it('puts the mode hint back if the tab closes mid-tour', () => {
    render(<ProductTour />);

    window.dispatchEvent(new Event('pagehide'));

    expect(mockTourState.restoreModeHint).toHaveBeenCalledTimes(1);
  });
});
