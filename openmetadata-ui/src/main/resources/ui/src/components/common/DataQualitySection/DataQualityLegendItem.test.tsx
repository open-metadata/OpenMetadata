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

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');

  return {
    ...actual,
    Typography: {
      ...actual.Typography,
      Text: jest
        .fn()
        .mockImplementation(({ children, className, ...props }) => (
          <span className={className} data-testid="typography-text" {...props}>
            {children}
          </span>
        )),
    },
  };
});

describe('DataQualityLegendItem', () => {
  it('should render legend item with count and label', () => {
    render(<DataQualityLegendItem count={10} label="Passed" type="success" />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('should return null when count is 0', () => {
    const { container } = render(
      <DataQualityLegendItem count={0} label="Passed" type="success" />
    );

    const legendItem = container.querySelector('.legend-item');

    expect(legendItem).not.toBeInTheDocument();
  });

  it('should return null when count is negative', () => {
    const { container } = render(
      <DataQualityLegendItem count={-5} label="Passed" type="success" />
    );

    const legendItem = container.querySelector('.legend-item');

    expect(legendItem).not.toBeInTheDocument();
  });

  it('should apply success class for success type', () => {
    const { container } = render(
      <DataQualityLegendItem count={10} label="Passed" type="success" />
    );

    const legendDot = container.querySelector('.legend-dot');

    expect(legendDot).toHaveClass('success');
  });

  it('should apply aborted class for aborted type', () => {
    const { container } = render(
      <DataQualityLegendItem count={5} label="Aborted" type="aborted" />
    );

    const legendDot = container.querySelector('.legend-dot');

    expect(legendDot).toHaveClass('aborted');
  });

  it('should apply failed class for failed type', () => {
    const { container } = render(
      <DataQualityLegendItem count={3} label="Failed" type="failed" />
    );

    const legendDot = container.querySelector('.legend-dot');

    expect(legendDot).toHaveClass('failed');
  });

  it('should have legend-text structure', () => {
    const { container } = render(
      <DataQualityLegendItem count={10} label="Passed" type="success" />
    );

    const legendText = container.querySelector('.legend-text');

    expect(legendText).toBeInTheDocument();
  });

  it('should render label as legend-text-label', () => {
    const { container } = render(
      <DataQualityLegendItem count={10} label="Test Label" type="success" />
    );

    const legendLabel = container.querySelector('.legend-text-label');

    expect(legendLabel).toBeInTheDocument();
    expect(legendLabel).toHaveTextContent('Test Label');
  });

  it('should render count as legend-text-value', () => {
    const { container } = render(
      <DataQualityLegendItem count={42} label="Passed" type="success" />
    );

    const legendValue = container.querySelector('.legend-text-value');

    expect(legendValue).toBeInTheDocument();
    expect(legendValue).toHaveTextContent('42');
  });

  it('should render with correct CSS structure', () => {
    const { container } = render(
      <DataQualityLegendItem count={10} label="Passed" type="success" />
    );

    const legendItem = container.querySelector('.legend-item');

    expect(legendItem).toHaveClass('legend-item');

    const legendDot = legendItem?.querySelector('.legend-dot');

    expect(legendDot).toHaveClass('legend-dot');
    expect(legendDot).toHaveClass('success');

    const legendText = legendItem?.querySelector('.legend-text');

    expect(legendText).toHaveClass('legend-text');
  });

  it('should render zero count when explicitly provided', () => {
    const { container } = render(
      <DataQualityLegendItem count={0} label="Zero" type="success" />
    );

    const legendItem = container.querySelector('.legend-item');

    expect(legendItem).not.toBeInTheDocument();
  });

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
