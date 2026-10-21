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

import { WidgetProps } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import CoreDateWidget from './CoreDateWidget';

const renderWidget = (props: Partial<WidgetProps>) =>
  render(
    <CoreDateWidget
      {...({
        id: 'root/startDate',
        label: 'Start Date',
        options: {},
        schema: { type: 'string', format: 'date' },
        onChange: jest.fn(),
        ...props,
      } as WidgetProps)}
    />
  );

describe('CoreDateWidget', () => {
  it('shows the stored ISO date', () => {
    renderWidget({ value: '2026-01-15' });

    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByTestId('date-widget-root/startDate')).toHaveTextContent(
      'Jan 15, 2026'
    );
  });

  it('falls back to the placeholder for an empty or invalid value', () => {
    renderWidget({ value: 'not-a-date' });

    expect(
      screen.getByTestId('date-widget-root/startDate')
    ).not.toHaveTextContent('2026');
  });

  it('is disabled when read-only', () => {
    renderWidget({ value: '2026-01-15', readonly: true });

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
