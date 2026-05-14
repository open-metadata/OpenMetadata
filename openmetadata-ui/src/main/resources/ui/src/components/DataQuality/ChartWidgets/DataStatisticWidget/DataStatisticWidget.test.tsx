/*
 *  Copyright 2024 Collate.
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
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { DataStatisticWidgetProps } from '../../DataQuality.interface';
import DataStatisticWidget from './DataStatisticWidget.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Skeleton: ({
    width,
    height,
  }: {
    width?: string | number;
    height?: number;
  }) => (
    <div data-testid="skeleton" style={{ width, height }}>
      Loading...
    </div>
  ),
  Typography: ({
    children,
    className,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span
      className={className as string}
      data-testid={props['data-testid'] as string}>
      {children}
    </span>
  ),
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button
      data-testid={props['data-testid'] as string}
      onClick={props.onClick as React.MouseEventHandler}>
      {props.iconTrailing as React.ReactNode}
      {children}
    </button>
  ),
  Divider: ({ className }: { className?: string }) => (
    <hr className={className} />
  ),
}));

const mockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg data-testid="test-icon" {...props} />
);

const mockProps: DataStatisticWidgetProps = {
  name: 'test-widget',
  title: 'Test Title',
  icon: mockIcon,
  dataLabel: 'items',
  countValue: 10,
  redirectPath: '/test-path',
  linkLabel: 'View Details',
  isLoading: false,
};

describe('DataStatisticWidget component', () => {
  it('should render the widget with provided props', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('test-widget-data-statistic-widget')
    ).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByTestId('total-value')).toHaveTextContent('10 items');
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('should show loading state when isLoading is true', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} isLoading />
      </MemoryRouter>
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('should render with custom icon props', () => {
    const iconProps = { width: 24, height: 24, fill: 'red' };
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} iconProps={iconProps} />
      </MemoryRouter>
    );

    const icon = screen.getByTestId('test-icon');

    expect(icon).toHaveAttribute('width', '24');
    expect(icon).toHaveAttribute('height', '24');
    expect(icon).toHaveAttribute('fill', 'red');
  });

  it('should apply styleType class to icon container', () => {
    const styleType: Lowercase<TestCaseStatus> = 'success';
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} styleType={styleType} />
      </MemoryRouter>
    );

    const iconContainer = screen.getByTestId('test-icon').parentElement;

    expect(iconContainer).toHaveClass('data-statistic-widget-icon', 'success');
  });

  it('should render correct link with redirectPath', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    const link = screen.getByRole('link');

    expect(link).toHaveAttribute('href', '/test-path');
  });

  it('should render link with correct label', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    const link = screen.getByRole('link');

    expect(link).toHaveTextContent('View Details');
  });

  it('should handle large count values correctly', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} countValue={999999} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('total-value')).toHaveTextContent('999999 items');
  });

  it('should handle zero count value', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} countValue={0} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('total-value')).toHaveTextContent('0 items');
  });

  it('should handle empty dataLabel', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} dataLabel="" />
      </MemoryRouter>
    );

    // When dataLabel is empty, there's no trailing space
    expect(screen.getByTestId('total-value')).toHaveTextContent('10');
  });

  it('should render link with proper navigation', () => {
    const { container } = render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    const link = container.querySelector('a[href="/test-path"]');

    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('View Details');
  });

  it('should render without styleType prop', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} styleType={undefined} />
      </MemoryRouter>
    );

    const iconContainer = screen.getByTestId('test-icon').parentElement;

    expect(iconContainer).toHaveClass('data-statistic-widget-icon');
    expect(iconContainer).not.toHaveClass('success');
    expect(iconContainer).not.toHaveClass('failed');
  });

  it('should render with different styleType values', () => {
    const styleTypes: Array<Lowercase<TestCaseStatus>> = [
      'success',
      'failed',
      'aborted',
    ];

    styleTypes.forEach((styleType) => {
      const { unmount } = render(
        <MemoryRouter>
          <DataStatisticWidget {...mockProps} styleType={styleType} />
        </MemoryRouter>
      );

      const iconContainer = screen.getByTestId('test-icon').parentElement;

      expect(iconContainer).toHaveClass(
        'data-statistic-widget-icon',
        styleType
      );

      unmount();
    });
  });

  it('should maintain proper structure', () => {
    const { container } = render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    const contentWrapper = container.querySelector(
      '.tw\\:flex.tw\\:gap-4.tw\\:items-center.tw\\:mb-1'
    );

    expect(contentWrapper).toBeInTheDocument();

    const titleSection = container.querySelector(
      '.data-statistic-widget-title'
    );

    expect(titleSection).toBeInTheDocument();
  });

  it('should render typography elements correctly', () => {
    render(
      <MemoryRouter>
        <DataStatisticWidget {...mockProps} />
      </MemoryRouter>
    );

    // Check title element exists
    const titleElement = screen.getByText('Test Title');

    expect(titleElement).toBeInTheDocument();

    // Check value element
    const valueParagraph = screen.getByTestId('total-value');

    expect(valueParagraph).toBeInTheDocument();
    expect(valueParagraph).toHaveTextContent('10 items');
  });
});
