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

import { fireEvent, render, screen } from '@testing-library/react';
import { CustomTooltip, renderLegend } from './DataInsightChartUtils';

describe('renderLegend', () => {
  it('renders one swatch per entry and greys out inactive ones', () => {
    const onClick = jest.fn();
    render(
      renderLegend(
        {
          payload: [
            { value: 'table', color: '#111111' },
            { value: 'topic', color: '#222222' },
          ],
          onClick,
        },
        ['table'],
        undefined,
        '#959595'
      )
    );

    const swatches = document.querySelectorAll('svg rect');

    expect(swatches[0]).toHaveAttribute('fill', '#111111');
    expect(swatches[1]).toHaveAttribute('fill', '#959595');

    fireEvent.click(screen.getByText('topic'));

    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'topic' }),
      1,
      expect.anything()
    );
  });

  it('applies the active theme muted color to inactive legends', () => {
    render(
      renderLegend(
        { payload: [{ color: '#abcdef', value: 'Table' }] },
        ['Dashboard'],
        undefined,
        '#345678'
      )
    );

    expect(screen.getByText('Table')).toHaveStyle({ color: '#345678' });
  });
});

describe('CustomTooltip', () => {
  it('uses the semantic text color for tooltip titles', () => {
    render(
      <CustomTooltip
        active
        payload={[
          {
            color: '#abcdef',
            dataKey: 'count',
            name: 'Description coverage',
            payload: { term: 'Sep 1, 2026' },
            value: 76.27,
          },
        ]}
        timeStampKey="term"
      />
    );

    expect(screen.getByRole('heading', { name: 'Sep 1, 2026' })).toHaveClass(
      'custom-data-insight-tooltip-title'
    );
  });

  it('renders a row per series from a structural payload', () => {
    render(
      <CustomTooltip
        active
        payload={[
          {
            dataKey: 'table',
            name: 'table',
            value: 4,
            color: '#111111',
            payload: { timestampValue: 1696118400000 },
          },
        ]}
      />
    );

    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(document.querySelector('svg rect')).toHaveAttribute(
      'fill',
      '#111111'
    );
  });
});
