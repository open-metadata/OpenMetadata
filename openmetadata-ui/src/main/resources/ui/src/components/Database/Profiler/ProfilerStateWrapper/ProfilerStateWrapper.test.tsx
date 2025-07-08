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
import ProfilerStateWrapper from './ProfilerStateWrapper.component';

// Mock ProfilerLatestValue component
jest.mock('../ProfilerLatestValue/ProfilerLatestValue', () => {
  return jest.fn(() => (
    <div data-testid="profiler-latest-value">ProfilerLatestValue</div>
  ));
});

describe('ProfilerStateWrapper', () => {
  const mockProfilerLatestValueProps = {
    information: [
      {
        title: 'Test Label',
        dataKey: 'testKey',
        color: '#000000',
        latestValue: '100',
      },
    ],
  };

  const defaultProps = {
    isLoading: false,
    title: 'Test Title',
    profilerLatestValueProps: mockProfilerLatestValueProps,
    children: <div>Test Content</div>,
  };

  it('renders without crashing', () => {
    render(<ProfilerStateWrapper {...defaultProps} />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<ProfilerStateWrapper {...defaultProps} isLoading />);

    const card = screen.getByTestId('profiler-details-card-container');

    expect(card).toHaveClass('ant-card-loading');
  });

  it('renders with custom data-testid', () => {
    const customTestId = 'custom-test-id';
    render(
      <ProfilerStateWrapper {...defaultProps} dataTestId={customTestId} />
    );

    expect(screen.getByTestId(customTestId)).toBeInTheDocument();
  });

  it('renders with default data-testid when not provided', () => {
    render(<ProfilerStateWrapper {...defaultProps} />);

    expect(
      screen.getByTestId('profiler-details-card-container')
    ).toBeInTheDocument();
  });

  it('renders ProfilerLatestValue with correct props', () => {
    render(<ProfilerStateWrapper {...defaultProps} />);

    const profilerLatestValue = screen.getByTestId('profiler-latest-value');

    expect(profilerLatestValue).toBeInTheDocument();
  });

  it('renders children content correctly', () => {
    const { title, profilerLatestValueProps, isLoading } = defaultProps;

    render(
      <ProfilerStateWrapper
        isLoading={isLoading}
        profilerLatestValueProps={profilerLatestValueProps}
        title={title}>
        <div>
          <h1>Custom Header</h1>
          <p>Custom Paragraph</p>
        </div>
      </ProfilerStateWrapper>
    );

    expect(screen.getByText('Custom Header')).toBeInTheDocument();
    expect(screen.getByText('Custom Paragraph')).toBeInTheDocument();
  });
});
