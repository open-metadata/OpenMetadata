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
import MemoriesView from './MemoriesView.component';
import { MemoryItem } from './MemoriesView.interface';

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => jest.fn(() => <div data-testid="error-placeholder" />)
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Card: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>
  ),
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
    Item: jest.fn(({ id, label }: { id: string; label: string }) => (
      <button data-testid={`dropdown-item-${id}`}>{label}</button>
    )),
  },
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockMemories: MemoryItem[] = [
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

    expect(screen.getByTestId('memories-view')).toBeInTheDocument();
  });

  it('renders a row for each memory when data is provided', () => {
    render(<MemoriesView data={mockMemories} isLoading={false} />);

    expect(screen.getByTestId('memory-row-mem-1')).toBeInTheDocument();
    expect(screen.getByTestId('memory-row-mem-2')).toBeInTheDocument();
  });

  it('renders title when provided, falling back to question', () => {
    render(<MemoriesView data={mockMemories} isLoading={false} />);

    expect(screen.getByText('My First Memory')).toBeInTheDocument();
    expect(screen.getByText('What is a pipeline?')).toBeInTheDocument();
  });

  it('renders the answer text', () => {
    render(<MemoriesView data={[mockMemories[0]]} isLoading={false} />);

    expect(
      screen.getByText('A unified metadata platform.')
    ).toBeInTheDocument();
  });

  it('renders the error placeholder when data is empty and not loading', () => {
    render(<MemoriesView data={[]} isLoading={false} />);

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(<MemoriesView isLoading data={[]} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });
});
