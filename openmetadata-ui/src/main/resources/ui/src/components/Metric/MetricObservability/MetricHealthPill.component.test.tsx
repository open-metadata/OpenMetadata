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
import { render, screen } from '@testing-library/react';
import { Health } from '../../../generated/api/data/metricObservability';
import MetricHealthPill from './MetricHealthPill.component';

describe('MetricHealthPill', () => {
  it.each([
    [Health.Healthy, 'label.healthy', 'tw:bg-utility-success-500'],
    [Health.AtRisk, 'label.at-risk', 'tw:bg-utility-warning-500'],
    [Health.Degraded, 'label.degraded', 'tw:bg-utility-error-500'],
    [Health.Unknown, 'label.unknown', 'tw:bg-utility-gray-500'],
  ])(
    'renders %s with a localized accessible label and semantic dot',
    (health, label, dotClassName) => {
      render(<MetricHealthPill health={health} score={81.6} />);

      expect(screen.getByTestId('metric-health-pill')).toHaveAccessibleName(
        `${label} 82`
      );

      const badge = screen.getByTestId('metric-health-pill').firstElementChild;

      expect(badge).toHaveClass('tw:gap-1.5');
      expect(badge?.firstElementChild).toHaveClass(dotClassName);
    }
  );

  it('renders loading and unknown states without announcing a false score', () => {
    const { rerender } = render(<MetricHealthPill isLoading />);

    expect(
      screen.getByTestId('metric-health-pill-loading')
    ).toBeInTheDocument();

    rerender(<MetricHealthPill />);

    expect(screen.getByTestId('metric-health-pill')).toHaveAccessibleName(
      'label.unknown'
    );
  });
});
