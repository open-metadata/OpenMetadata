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
import {
  IncidentTrendDirection,
  Severities,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  INCIDENT_TREND_COLORS,
  INCIDENT_TREND_TEXT_CLASSES,
} from './IncidentGroups.constants';
import { getIncidentTrendPoints } from './IncidentGroups.utils';
import IncidentTrendSparkline from './IncidentTrendSparkline';

describe('IncidentTrendSparkline', () => {
  it('should draw the line and its direction label', () => {
    render(
      <IncidentTrendSparkline
        severity={Severities.Severity1}
        trend={[1, 0, 0, 0, 2, 3, 4, 5]}
        trendDirection={IncidentTrendDirection.Rising}
      />
    );

    expect(screen.getByTestId('incident-trend-line')).toHaveAttribute(
      'points',
      getIncidentTrendPoints([1, 0, 0, 0, 2, 3, 4, 5])
    );
    expect(screen.getByTestId('incident-trend-line')).toHaveAttribute(
      'stroke',
      INCIDENT_TREND_COLORS.error
    );
    expect(screen.getByTestId('incident-trend-direction')).toHaveTextContent(
      'label.rising'
    );
    // The label carries the same tone as the line, as a token class.
    expect(screen.getByTestId('incident-trend-direction')).toHaveClass(
      INCIDENT_TREND_TEXT_CLASSES.error
    );
  });

  it('should render nothing when the group carries no trend', () => {
    const { container: withoutTrend } = render(<IncidentTrendSparkline />);

    expect(withoutTrend).toBeEmptyDOMElement();

    const { container: emptyTrend } = render(
      <IncidentTrendSparkline trend={[]} />
    );

    expect(emptyTrend).toBeEmptyDOMElement();
  });

  it('should draw the line without a label when the direction is absent', () => {
    render(<IncidentTrendSparkline trend={[1, 2, 3]} />);

    expect(screen.getByTestId('incident-trend-line')).toHaveAttribute(
      'stroke',
      INCIDENT_TREND_COLORS.neutral
    );
    expect(
      screen.queryByTestId('incident-trend-direction')
    ).not.toBeInTheDocument();
  });
});
