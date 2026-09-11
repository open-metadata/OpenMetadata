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
import type { DateTimeWidgetProps } from '@react-awesome-query-builder/ui';
import OMDateWidget from './OMDateWidget';

const renderWidget = (props: Partial<DateTimeWidgetProps> = {}) =>
  render(
    <OMDateWidget
      {...({
        delta: 0,
        fieldType: 'datetime',
        setValue: jest.fn(),
        value: '',
        ...props,
      } as unknown as DateTimeWidgetProps)}
    />
  );

describe('OMDateWidget', () => {
  // A native date input is intrinsically wide. Left unconstrained it overflows
  // its slot, and a two-valued operator's second input then sits over the
  // first and swallows the clicks meant for it.
  it('should fill its slot rather than keep its intrinsic width', () => {
    renderWidget();

    const input = screen.getByTestId('query-date-value-0');

    expect(input).toHaveClass('tw:w-full');
    expect(input).toHaveClass('tw:min-w-0');
  });

  it('should name each value slot by its position', () => {
    renderWidget({ delta: 1 } as Partial<DateTimeWidgetProps>);

    expect(screen.getByTestId('query-date-value-1')).toBeInTheDocument();
  });
});
