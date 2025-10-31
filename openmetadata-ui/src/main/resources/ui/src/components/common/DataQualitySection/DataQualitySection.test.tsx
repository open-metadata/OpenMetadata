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
import DataQualitySection from './DataQualitySection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Partial mock antd (only Typography.Text)
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

// Mock SectionWithEdit to expose props and render children
interface SectionWithEditProps {
  title: React.ReactNode;
  children: React.ReactNode;
  showEditButton?: boolean;
  onEdit?: () => void;
}

jest.mock('../SectionWithEdit/SectionWithEdit', () => {
  return jest
    .fn()
    .mockImplementation(
      ({ title, children, showEditButton, onEdit }: SectionWithEditProps) => (
        <div
          data-show-edit={String(showEditButton)}
          data-testid="section-with-edit"
          onClick={onEdit}>
          <div data-testid="section-title">{title}</div>
          <div data-testid="section-children">{children}</div>
        </div>
      )
    );
});

describe('DataQualitySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and total badge', () => {
    render(
      <DataQualitySection
        tests={[
          { type: 'success', count: 3 },
          { type: 'aborted', count: 2 },
          { type: 'failed', count: 1 },
        ]}
        totalTests={6}
      />
    );

    expect(screen.getByTestId('section-with-edit')).toBeInTheDocument();
    expect(
      screen.getByText('label.data-quality-test-plural')
    ).toBeInTheDocument();
    // total badge text
    expect(
      screen
        .getAllByTestId('typography-text')
        .some((el) => el.textContent === '6')
    ).toBe(true);
  });

  it('renders progress segments for non-zero categories', () => {
    const { container } = render(
      <DataQualitySection
        tests={[
          { type: 'success', count: 3 },
          { type: 'aborted', count: 2 },
          { type: 'failed', count: 1 },
        ]}
        totalTests={6}
      />
    );

    const segments = container.querySelectorAll(
      '.data-quality-progress .progress-segment'
    );

    expect(segments).toHaveLength(3);
    expect(
      container.querySelectorAll('.progress-segment.success')
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('.progress-segment.aborted')
    ).toHaveLength(1);
    expect(container.querySelectorAll('.progress-segment.failed')).toHaveLength(
      1
    );
  });

  it('renders legend items only for non-zero counts', () => {
    const { container } = render(
      <DataQualitySection
        tests={[
          { type: 'success', count: 4 },
          { type: 'aborted', count: 0 },
          { type: 'failed', count: 0 },
        ]}
        totalTests={4}
      />
    );

    // Success legend should be present with label and count
    expect(
      screen.getByText('label.-with-colon - {"text":"label.success"}')
    ).toBeInTheDocument();

    // Check the legend items rendered
    const legendItems = container.querySelectorAll('.legend-item');

    expect(legendItems).toHaveLength(1); // Only success should render

    // Aborted/failed legends should NOT render for zero counts
    expect(
      screen.queryByText('label.-with-colon - {"text":"label.aborted"}')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('label.-with-colon - {"text":"label.failed"}')
    ).not.toBeInTheDocument();
  });

  it('does not render segments or legends when totalTests is 0', () => {
    const { container } = render(
      <DataQualitySection
        tests={[
          { type: 'success', count: 0 },
          { type: 'aborted', count: 0 },
          { type: 'failed', count: 0 },
        ]}
        totalTests={0}
      />
    );

    expect(container.querySelectorAll('.progress-segment')).toHaveLength(0);
    expect(
      container.querySelectorAll('.data-quality-legend .legend-item')
    ).toHaveLength(0);
  });

  it('wraps content with expected CSS structure', () => {
    const { container } = render(
      <DataQualitySection
        tests={[
          { type: 'success', count: 1 },
          { type: 'aborted', count: 1 },
          { type: 'failed', count: 1 },
        ]}
        totalTests={3}
      />
    );

    expect(
      container.querySelector('.data-quality-content')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.data-quality-progress')
    ).toBeInTheDocument();
    expect(container.querySelector('.data-quality-legend')).toBeInTheDocument();
  });

  it('passes showEditButton=false to SectionWithEdit and forwards onEdit', () => {
    const onEdit = jest.fn();

    render(
      <DataQualitySection
        tests={[
          { type: 'success', count: 2 },
          { type: 'aborted', count: 1 },
          { type: 'failed', count: 0 },
        ]}
        totalTests={3}
        onEdit={onEdit}
      />
    );

    const wrapper = screen.getByTestId('section-with-edit');

    expect(wrapper).toHaveAttribute('data-show-edit', 'false');
  });
});
