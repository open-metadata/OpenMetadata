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

import { fireEvent, render, screen } from '@testing-library/react';
import ArticleCard from './ArticleCard.component';
import { ArticleCardItem } from './ArticleCard.interface';

jest.mock('utils/FeedUtils', () => ({
  getFrontEndFormat: jest.fn((v) => v),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getShortRelativeTime: jest.fn(() => '2 days ago'),
  getEpochMillisForPastDays: jest.fn(() => 0),
  getStartOfDayInMillis: jest.fn(() => 0),
  getEndOfDayInMillis: jest.fn(() => 0),
  getCurrentMillis: jest.fn(() => 0),
}));

jest.mock('components/common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn(({ markdown }: { markdown: string }) => <div>{markdown}</div>)
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest.fn(
    ({ children, color }: { children: React.ReactNode; color: string }) => (
      <span data-color={color}>{children}</span>
    )
  ),
  Card: jest.fn(
    ({
      children,
      onClick,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      'data-testid'?: string;
    }) => (
      <div data-testid={testId} onClick={onClick}>
        {children}
      </div>
    )
  ),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockArticle: ArticleCardItem = {
  id: 'article-1',
  title: 'Test Article',
  description: 'This is a test description',
  tags: [{ label: 'tag1' }, { label: 'tag2' }],
};

describe('ArticleCard', () => {
  it('renders the article card with title and description', () => {
    render(<ArticleCard article={mockArticle} />);

    expect(screen.getByTestId('article-card')).toBeInTheDocument();
    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByText('This is a test description')).toBeInTheDocument();
  });

  it('renders tags when provided', () => {
    render(<ArticleCard article={mockArticle} />);

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
  });

  it('does not render tags section when tags array is empty', () => {
    const articleWithNoTags: ArticleCardItem = { ...mockArticle, tags: [] };
    render(<ArticleCard article={articleWithNoTags} />);

    expect(screen.queryByText('tag1')).not.toBeInTheDocument();
  });

  it('shows lastEditedAt when provided', () => {
    const article: ArticleCardItem = {
      ...mockArticle,
      lastEditedAt: 1700000000000,
    };
    render(<ArticleCard article={article} />);

    expect(screen.getByText(/last-updated/)).toBeInTheDocument();
    expect(screen.getByText(/2 days ago/)).toBeInTheDocument();
  });

  it('does not show lastEditedAt when not provided', () => {
    render(<ArticleCard article={mockArticle} />);

    expect(screen.queryByText(/last-updated/)).not.toBeInTheDocument();
  });

  it('calls onClick with the article when the card is clicked', () => {
    const onClick = jest.fn();
    render(<ArticleCard article={mockArticle} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('article-card'));

    expect(onClick).toHaveBeenCalledWith(mockArticle);
  });

  it('does not throw when onClick is not provided', () => {
    render(<ArticleCard article={mockArticle} />);

    expect(() =>
      fireEvent.click(screen.getByTestId('article-card'))
    ).not.toThrow();
  });
});
