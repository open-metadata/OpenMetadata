/*
 *  Copyright 2025 Collate.
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
import { DataQualityLegendItem } from './DataQualityLegendItem';

describe('DataQualityLegendItem', () => {
  it('should render legend item with count and label', () => {
    render(<DataQualityLegendItem count={10} label="Passed" type="success" />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it.each([0, -5])('should return null when count is %s', (count) => {
    const { container } = render(
      <DataQualityLegendItem count={count} label="Passed" type="success" />
    );

    expect(container.querySelector('.legend-item')).not.toBeInTheDocument();
  });

  it.each(['success', 'aborted', 'failed'] as const)(
    'should tag the legend item with the %s type',
    (type) => {
      const { container } = render(
        <DataQualityLegendItem count={3} label="Label" type={type} />
      );

      expect(container.querySelector('.legend-item')).toHaveClass(type);
    }
  );

  it('should render large count values', () => {
    render(
      <DataQualityLegendItem count={999999} label="Large" type="success" />
    );

    expect(screen.getByText('999999')).toBeInTheDocument();
  });

  it('should handle long label text', () => {
    const longLabel =
      'This is a very long label that should still render correctly';
    render(
      <DataQualityLegendItem count={10} label={longLabel} type="success" />
    );

    expect(screen.getByText(longLabel)).toBeInTheDocument();
  });
});
