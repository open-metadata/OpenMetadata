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
import { Health } from '../../../generated/api/data/metricObservability';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import MetricListHealth from './MetricListHealth.component';

jest.mock('../../../hooks/useMetricObservability');

const mockUseMetricObservability = useMetricObservability as jest.Mock;
const refetch = jest.fn();
const METRIC_ID = 'metric-1';
const HEALTH_PILL_TEST_ID = 'metric-health-pill';
const originalIntersectionObserver = window.IntersectionObserver;

const setIntersectionObserver = (
  observer: typeof IntersectionObserver | undefined
) => {
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: observer,
    writable: true,
  });
};

describe('MetricListHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setIntersectionObserver(undefined);
    mockUseMetricObservability.mockReturnValue({
      observability: undefined,
      error: undefined,
      isPending: false,
      refetch,
    });
  });

  afterAll(() => {
    setIntersectionObserver(originalIntersectionObserver);
  });

  it('falls back to eager loading without an observer and renders health', () => {
    mockUseMetricObservability.mockReturnValue({
      observability: { health: Health.Healthy, score: 96 },
      error: undefined,
      isPending: false,
      refetch,
    });

    render(<MetricListHealth metricId={METRIC_ID} />);

    expect(mockUseMetricObservability).toHaveBeenCalledWith(METRIC_ID, {
      enabled: true,
    });

    expect(
      screen.getByTestId(`${HEALTH_PILL_TEST_ID}-score`)
    ).toHaveTextContent('96');
    expect(screen.getByTestId(HEALTH_PILL_TEST_ID)).toHaveAccessibleName(
      'label.healthy 96'
    );
  });

  it('renders an accessible loading state', () => {
    mockUseMetricObservability.mockReturnValue({
      observability: undefined,
      error: undefined,
      isPending: true,
      refetch,
    });

    render(<MetricListHealth metricId={METRIC_ID} />);

    expect(
      screen.getByTestId('metric-health-pill-loading')
    ).toBeInTheDocument();
  });

  it('shows unknown health and retries a failed request', () => {
    mockUseMetricObservability.mockReturnValue({
      observability: undefined,
      error: new Error('network'),
      isPending: false,
      refetch,
    });

    render(<MetricListHealth metricId={METRIC_ID} />);

    expect(screen.getByTestId(HEALTH_PILL_TEST_ID)).toHaveTextContent(
      'label.unknown'
    );

    fireEvent.click(screen.getByTestId('retry-metric-health-metric-1'));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('defers the query until the health slot approaches the viewport', () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const disconnect = jest.fn();
    const observer = {
      disconnect,
      observe: jest.fn(),
      root: null,
      rootMargin: '200px 0px',
      takeRecords: jest.fn().mockReturnValue([]),
      thresholds: [0],
      unobserve: jest.fn(),
    } satisfies IntersectionObserver;
    const IntersectionObserverMock = jest.fn(
      (callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;

        return observer;
      }
    );
    setIntersectionObserver(
      IntersectionObserverMock as unknown as typeof IntersectionObserver
    );

    render(<MetricListHealth metricId={METRIC_ID} />);

    expect(mockUseMetricObservability).toHaveBeenLastCalledWith(METRIC_ID, {
      enabled: false,
    });
    expect(
      screen.getByRole('group', { name: 'label.health' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('metric-health-slot-metric-1')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(observer.observe).toHaveBeenCalledWith(
      screen.getByTestId('metric-health-slot-metric-1')
    );
    expect(IntersectionObserverMock).toHaveBeenCalledWith(
      expect.any(Function),
      { rootMargin: '200px 0px' }
    );

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });

    expect(mockUseMetricObservability).toHaveBeenLastCalledWith(METRIC_ID, {
      enabled: true,
    });
    expect(disconnect).toHaveBeenCalled();
  });

  it('keeps the query disabled while the health slot is offscreen', () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const observer = {
      disconnect: jest.fn(),
      observe: jest.fn(),
      root: null,
      rootMargin: '200px 0px',
      takeRecords: jest.fn().mockReturnValue([]),
      thresholds: [0],
      unobserve: jest.fn(),
    } satisfies IntersectionObserver;
    setIntersectionObserver(
      jest.fn((callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;

        return observer;
      }) as unknown as typeof IntersectionObserver
    );

    render(<MetricListHealth metricId={METRIC_ID} />);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });

    expect(mockUseMetricObservability).toHaveBeenLastCalledWith(METRIC_ID, {
      enabled: false,
    });
    expect(observer.disconnect).not.toHaveBeenCalled();
  });
});
