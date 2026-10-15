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
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import MemoriesView from './MemoriesView.component';

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    // Echoes the count, so a test can tell which count a label shows.
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () =>
  jest.fn(() => <div data-testid="profile-picture" />)
);

jest.mock('../../CopyLinkButton/CopyLinkButton.component', () =>
  jest.fn(() => <button aria-label="Copy link" data-testid="copy-link-btn" />)
);

jest.mock('../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: jest.fn(() => <svg />),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  Box: jest.fn(
    ({
      children,
      ...rest
    }: {
      children: React.ReactNode;
    } & React.HTMLAttributes<HTMLDivElement>) => <div {...rest}>{children}</div>
  ),
  ButtonUtility: jest.fn(
    ({
      onClick,
      isDisabled,
      'data-testid': testId = 'button-utility',
    }: {
      onClick?: () => void;
      isDisabled?: boolean;
      'data-testid'?: string;
    }) => (
      <button
        aria-label="Button utility"
        data-testid={testId}
        disabled={isDisabled}
        onClick={onClick}
      />
    )
  ),
  Dot: jest.fn(() => <span />),
  EmptyPlaceholder: jest.fn(({ title }: { title?: React.ReactNode }) => (
    <div data-testid="empty-placeholder">{title}</div>
  )),
  Dropdown: {
    Root: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    DotsButton: jest.fn(() => <button>⋯</button>),
    Popover: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    Menu: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    Item: jest.fn(
      ({ id, children }: { id: string; children: React.ReactNode }) => (
        <button data-testid={`dropdown-item-${id}`}>{children}</button>
      )
    ),
  },
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Typography: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={testId}>{children}</span>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  ThumbsDown: jest.fn(() => <svg />),
  ThumbsUp: jest.fn(() => <svg />),
}));

const mockMemories: ContextMemory[] = [
  {
    id: 'mem-1',
    name: 'my-first-memory',
    title: 'My First Memory',
    question: 'What is OpenMetadata?',
    answer: 'A unified metadata platform.',
    updatedBy: 'alice',
    updatedAt: 1778756959299,
  },
  {
    id: 'mem-2',
    name: 'pipeline-memory',
    question: 'What is a pipeline?',
    answer: 'A workflow for data ingestion.',
  },
];

describe('MemoriesView', () => {
  it('renders the memories view container', () => {
    render(<MemoriesView data={mockMemories} isLoading={false} />);

    expect(screen.getByTestId('memory-row-mem-1')).toBeInTheDocument();
  });

  it('renders a row for each memory when data is provided', () => {
    render(<MemoriesView data={mockMemories} isLoading={false} />);

    expect(screen.getByTestId('memory-row-mem-1')).toBeInTheDocument();
    expect(screen.getByTestId('memory-row-mem-2')).toBeInTheDocument();
  });

  it('renders title when provided, falling back to name', () => {
    render(<MemoriesView data={mockMemories} isLoading={false} />);

    expect(screen.getByText('My First Memory')).toBeInTheDocument();
    // mem-2 has no title, falls back to name
    expect(screen.getByText('pipeline-memory')).toBeInTheDocument();
  });

  it('renders the answer text', () => {
    render(<MemoriesView data={[mockMemories[0]]} isLoading={false} />);

    expect(
      screen.getByText('A unified metadata platform.')
    ).toBeInTheDocument();
  });

  it.each<[ContextMemoryStatus, string]>([
    [ContextMemoryStatus.Deprecated, 'label.deprecated'],
    [ContextMemoryStatus.Rejected, 'label.rejected'],
    [ContextMemoryStatus.Superseded, 'label.superseded'],
    [ContextMemoryStatus.Invalidated, 'label.invalidated'],
  ])('shows the %s memory status and its reason', (status, label) => {
    render(
      <MemoriesView
        data={[
          {
            ...mockMemories[0],
            entityStatus: status,
            statusReason: 'The replacement has the corrected definition.',
          },
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getByText(/The replacement has the corrected definition/)
    ).toBeInTheDocument();
  });

  it('renders filter empty placeholder when filtered and data is empty', () => {
    render(<MemoriesView isFiltered data={[]} isLoading={false} />);

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('label.no-results-for-filters')
    ).toBeInTheDocument();
  });

  it('renders search empty placeholder when searching and data is empty', () => {
    render(<MemoriesView isSearching data={[]} isLoading={false} />);

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(screen.getByText('label.no-matching-results')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(<MemoriesView isLoading data={[]} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });

  it('shows the votes and corrections of a memory whose outcomes are counted', () => {
    render(
      <MemoriesView
        data={[
          {
            ...mockMemories[0],
            outcomes: {
              appliedCount: 12,
              positiveCount: 3,
              negativeCount: 1,
              correctedCount: 2,
              countedAt: 1778756959299,
            },
          },
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('memory-usage-info')).toHaveTextContent(
      'label.cited-n-times:12'
    );
    expect(screen.getByTestId('memory-helpful-count')).toHaveTextContent('3');
    expect(screen.getByTestId('memory-unhelpful-count')).toHaveTextContent('1');
    expect(screen.getByTestId('memory-corrected-count')).toHaveTextContent(
      'label.corrected-n-times:2'
    );
  });

  it('shows no vote or correction count that is zero', () => {
    render(
      <MemoriesView
        data={[
          {
            ...mockMemories[0],
            outcomes: { appliedCount: 4, countedAt: 1778756959299 },
          },
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('memory-usage-info')).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-helpful-count')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-unhelpful-count')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-corrected-count')
    ).not.toBeInTheDocument();
  });

  it('shows the legacy usage of a memory whose outcomes are not counted yet', () => {
    render(
      <MemoriesView
        data={[{ ...mockMemories[0], usageCount: 5 }]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('memory-usage-info')).toHaveTextContent(
      'label.cited-n-times:5'
    );
  });

  it('shows the legacy usage of a search-listed memory never counted', () => {
    // A search hit carries the indexed usage and, until a recount, no outcomes.
    render(
      <MemoriesView
        data={[
          {
            ...mockMemories[0],
            usageCount: 37,
            lastUsedAt: 1778756959299,
            entityStatus: ContextMemoryStatus.Approved,
          },
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('memory-usage-info')).toHaveTextContent(
      'label.cited-n-times:37'
    );
  });

  it('shows the legacy usage when no recount stamped the outcomes', () => {
    render(
      <MemoriesView
        data={[
          {
            ...mockMemories[0],
            usageCount: 37,
            outcomes: {
              appliedCount: 0,
              positiveCount: 0,
              negativeCount: 0,
              correctedCount: 0,
            },
          },
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('memory-usage-info')).toHaveTextContent(
      'label.cited-n-times:37'
    );
  });

  it('shows no usage for a memory never cited', () => {
    render(<MemoriesView data={[mockMemories[1]]} isLoading={false} />);

    expect(screen.queryByTestId('memory-usage-info')).not.toBeInTheDocument();
  });
});
