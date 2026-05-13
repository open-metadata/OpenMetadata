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
import { ArticleCardItem } from '../ArticleCard/ArticleCard.interface';
import ArticleListSection from './ArticleListSection.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('utils/KnowledgePageUtils', () => ({
  getKnowledgePagePath: jest.fn((id: string) => `/knowledge/${id}`),
}));

jest.mock('../ArticleCard/ArticleCard.component', () =>
  jest.fn(
    ({
      article,
      onClick,
    }: {
      article: ArticleCardItem;
      onClick?: (a: ArticleCardItem) => void;
    }) => (
      <div
        data-testid={`article-card-${article.id}`}
        onClick={() => onClick?.(article)}>
        {article.title}
      </div>
    )
  )
);

jest.mock('components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="error-placeholder" />)
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  Card: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>
  ),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockArticles: ArticleCardItem[] = [
  { id: 'a1', title: 'Article One', description: 'Desc 1' },
  { id: 'a2', title: 'Article Two', description: 'Desc 2' },
];

describe('ArticleListSection', () => {
  it('renders the section with title', () => {
    render(
      <ArticleListSection articles={mockArticles} title="Recent Articles" />
    );

    expect(screen.getByTestId('article-list-section')).toBeInTheDocument();
    expect(screen.getByText('Recent Articles')).toBeInTheDocument();
  });

  it('renders a subtitle when provided', () => {
    render(
      <ArticleListSection
        articles={mockArticles}
        subtitle="A short description"
        title="Recent Articles"
      />
    );

    expect(screen.getByText('A short description')).toBeInTheDocument();
  });

  it('renders article cards for each article', () => {
    render(
      <ArticleListSection articles={mockArticles} title="Recent Articles" />
    );

    expect(screen.getByTestId('article-card-a1')).toBeInTheDocument();
    expect(screen.getByTestId('article-card-a2')).toBeInTheDocument();
  });

  it('renders the error placeholder when articles list is empty', () => {
    render(<ArticleListSection articles={[]} title="Recent Articles" />);

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('renders skeletons when isLoading is true', () => {
    render(
      <ArticleListSection isLoading articles={[]} title="Recent Articles" />
    );

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
  });

  it('shows the view-all button when onViewAll is provided', () => {
    const onViewAll = jest.fn();
    render(
      <ArticleListSection
        articles={mockArticles}
        title="Recent Articles"
        onViewAll={onViewAll}
      />
    );

    expect(screen.getByText(/view-all/i)).toBeInTheDocument();
  });

  it('does not show the view-all button when neither viewAllHref nor onViewAll is provided', () => {
    render(
      <ArticleListSection articles={mockArticles} title="Recent Articles" />
    );

    expect(screen.queryByText(/view-all/i)).not.toBeInTheDocument();
  });

  it('calls onViewAll when the view-all button is clicked', () => {
    const onViewAll = jest.fn();
    render(
      <ArticleListSection
        articles={mockArticles}
        title="Recent Articles"
        onViewAll={onViewAll}
      />
    );

    fireEvent.click(screen.getByText(/view-all/i));

    expect(onViewAll).toHaveBeenCalled();
  });

  it('calls onArticleClick when an article card is clicked', () => {
    const onArticleClick = jest.fn();
    render(
      <ArticleListSection
        articles={mockArticles}
        title="Recent Articles"
        onArticleClick={onArticleClick}
      />
    );

    fireEvent.click(screen.getByTestId('article-card-a1'));

    expect(onArticleClick).toHaveBeenCalledWith(mockArticles[0]);
  });

  it('navigates to the knowledge page path when no onArticleClick is provided', () => {
    render(
      <ArticleListSection articles={mockArticles} title="Recent Articles" />
    );

    fireEvent.click(screen.getByTestId('article-card-a1'));

    expect(mockNavigate).toHaveBeenCalledWith('/knowledge/a1');
  });

  it('opens external href in a new tab when article href starts with http', () => {
    const articleWithHref: ArticleCardItem = {
      id: 'a3',
      title: 'External',
      description: 'Ext',
      href: 'https://example.com',
    };
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ArticleListSection
        articles={[articleWithHref]}
        title="Recent Articles"
      />
    );

    fireEvent.click(screen.getByTestId('article-card-a3'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer'
    );

    openSpy.mockRestore();
  });

  it('navigates to the internal href when article href does not start with http', () => {
    const articleWithHref: ArticleCardItem = {
      id: 'a4',
      title: 'Internal',
      description: 'Int',
      href: '/internal/path',
    };
    render(
      <ArticleListSection
        articles={[articleWithHref]}
        title="Recent Articles"
      />
    );

    fireEvent.click(screen.getByTestId('article-card-a4'));

    expect(mockNavigate).toHaveBeenCalledWith('/internal/path');
  });

  it('uses getPagePath override when provided', () => {
    const getPagePath = jest.fn((id: string) => `/custom/${id}`);
    render(
      <ArticleListSection
        articles={mockArticles}
        getPagePath={getPagePath}
        title="Recent Articles"
      />
    );

    fireEvent.click(screen.getByTestId('article-card-a1'));

    expect(getPagePath).toHaveBeenCalledWith('a1');
    expect(mockNavigate).toHaveBeenCalledWith('/custom/a1');
  });
});
