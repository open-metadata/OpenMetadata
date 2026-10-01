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
import CoverageStat from './CoverageStat';

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({
    children,
    'data-testid': dataTestId,
  }: {
    children?: React.ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={dataTestId}>{children}</span>,
}));

// The trend is the core area chart's problem; this component only decides
// whether there is one to draw.
jest.mock('./Sparkline', () => () => <div data-testid="sparkline" />);

const LABEL = 'Description Coverage';
const TEST_ID = 'coverage';

describe('CoverageStat', () => {
  it('renders the value and its point movement', () => {
    render(
      <CoverageStat dataTestId={TEST_ID} delta={0.4} label={LABEL} value={23} />
    );

    expect(screen.getByTestId(TEST_ID)).toHaveTextContent('23%');
    expect(screen.getByText('+0.4')).toBeInTheDocument();
  });

  it('hides the delta when nothing moved', () => {
    render(
      <CoverageStat dataTestId={TEST_ID} delta={0} label={LABEL} value={23} />
    );

    expect(screen.queryByText('+0')).not.toBeInTheDocument();
  });

  // Guards the regression this file shipped with: `series` was used in the JSX
  // but never imported or destructured, which only blew up once this branch
  // actually rendered.
  it('draws the trend behind the value when given a series', () => {
    render(
      <CoverageStat
        dataTestId={TEST_ID}
        delta={0.4}
        label={LABEL}
        series={[20, 21, 23]}
        value={23}
      />
    );

    expect(screen.getByTestId('sparkline')).toBeInTheDocument();
  });

  it('draws no trend from a single point', () => {
    render(
      <CoverageStat
        dataTestId={TEST_ID}
        delta={null}
        label={LABEL}
        series={[23]}
        value={23}
      />
    );

    expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument();
  });
});
