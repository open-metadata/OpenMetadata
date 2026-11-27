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

const mockTranslate = jest.fn(
  (key: string, values?: Record<string, string | number>) => {
    if (key === 'message.open-incident-count-change') {
      return `Open incidents from ${values?.startCount} to ${values?.endCount}.`;
    }
    if (key === 'message.open-incident-trend') {
      return `Open incidents: ${values?.startCount} at ${values?.startDate}, ${values?.endCount} at ${values?.endDate}.`;
    }

    return key;
  }
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: (time: number) => `date:${time}`,
}));

describe('IncidentTrendSparkline', () => {
  it('should expose the open count history instead of hiding the graph from assistive technology', () => {
    render(
      <IncidentTrendSparkline
        trend={[3, 3, 4, 4]}
        trendDirection={IncidentTrendDirection.Rising}
      />
    );

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Open incidents from 3 to 4.'
    );
  });

  it('should describe the actual response bounds instead of assuming seven days', () => {
    render(
      <IncidentTrendSparkline
        trend={[3, 3, 4, 4]}
        trendEnd={86400000}
        trendStart={0}
      />
    );

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Open incidents: 3 at date:0, 4 at date:86400000.'
    );
    expect(mockTranslate).toHaveBeenCalledWith('message.open-incident-trend', {
      startCount: 3,
      endCount: 4,
      startDate: 'date:0',
      endDate: 'date:86400000',
    });
  });

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
