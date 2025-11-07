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
import { DataQualityStatCard } from './DataQualityStatCard';

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

describe('DataQualityStatCard', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('should render stat card with count and label', () => {
    render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('should apply active class when isActive is true', () => {
    const { container } = render(
      <DataQualityStatCard
        isActive
        count={10}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');

    expect(button).toHaveClass('data-quality-stat-card');
    expect(button).toHaveClass('success-card');
    expect(button).toHaveClass('active');
  });

  it('should not apply active class when isActive is false', () => {
    const { container } = render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');

    expect(button).not.toHaveClass('active');
  });

  it('should apply correct type class for success', () => {
    const { container } = render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');

    expect(button).toHaveClass('success-card');
  });

  it('should apply correct type class for aborted', () => {
    const { container } = render(
      <DataQualityStatCard
        count={5}
        isActive={false}
        label="Aborted"
        type="aborted"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');

    expect(button).toHaveClass('aborted-card');
  });

  it('should apply correct type class for failed', () => {
    const { container } = render(
      <DataQualityStatCard
        count={3}
        isActive={false}
        label="Failed"
        type="failed"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');

    expect(button).toHaveClass('failed-card');
  });

  it('should call onClick when button is clicked', () => {
    const { container } = render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');
    if (button) {
      button.click();
    }

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should render with button type', () => {
    const { container } = render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const button = container.querySelector('button');

    expect(button).toHaveAttribute('type', 'button');
  });

  it('should apply correct stat count class', () => {
    const { container } = render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const statCounts = container.querySelectorAll('.stat-count');

    expect(statCounts.length).toBeGreaterThan(0);
    expect(statCounts[0]).toHaveClass('success');
  });

  it('should apply correct stat label class', () => {
    const { container } = render(
      <DataQualityStatCard
        count={10}
        isActive={false}
        label="Passed"
        type="success"
        onClick={mockOnClick}
      />
    );

    const statLabels = container.querySelectorAll('.stat-label');

    expect(statLabels.length).toBeGreaterThan(0);
    expect(statLabels[0]).toHaveClass('success');
  });

  it('should render zero count', () => {
    render(
      <DataQualityStatCard
        count={0}
        isActive={false}
        label="Empty"
        type="success"
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render large count', () => {
    render(
      <DataQualityStatCard
        count={999999}
        isActive={false}
        label="Large"
        type="success"
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('999999')).toBeInTheDocument();
  });
});
