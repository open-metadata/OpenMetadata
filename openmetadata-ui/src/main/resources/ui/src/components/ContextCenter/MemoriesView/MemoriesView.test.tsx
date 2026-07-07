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
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import MemoriesView from './MemoriesView.component';

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () =>
  jest.fn(() => <div data-testid="profile-picture" />)
);

jest.mock('../../CopyLinkButton/CopyLinkButton.component', () =>
  jest.fn(() => <button data-testid="copy-link-btn" />)
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
      <button data-testid={testId} disabled={isDisabled} onClick={onClick} />
    )
  ),
  Dot: jest.fn(() => <span />),
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
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
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

  it('renders no-data message when data is empty and not loading', () => {
    render(<MemoriesView data={[]} isLoading={false} />);

    expect(screen.getByText('label.no-entity-available')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(<MemoriesView isLoading data={[]} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });
});
