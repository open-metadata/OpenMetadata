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
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  KnowledgePage,
  PageType,
} from '../../../../interface/knowledge-center.interface';
import { queryClient } from '../../../../queryClient';
import { getListKnowledgePages } from '../../../../rest/knowledgeCenterAPI';
import ContextCenterWidget, {
  CONTEXT_CENTER_FETCH_LIMIT,
} from './ContextCenterWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../Common/TopicWidget/TopicCard', () => ({
  __esModule: true,
  default: ({
    children,
    isError,
    meta,
    status,
    summary,
  }: {
    children?: React.ReactNode;
    isError?: boolean;
    meta?: React.ReactNode;
    status?: { label: string };
    summary: React.ReactNode;
  }) => (
    <section>
      <p data-testid="summary">{summary}</p>
      {status && <span data-testid="status">{status.label}</span>}
      {meta && <span data-testid="meta">{meta}</span>}
      {isError && <span data-testid="card-error" />}
      {children}
    </section>
  ),
}));

jest.mock('../../../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: () => '1h',
}));

const mockList = getListKnowledgePages as jest.MockedFunction<
  typeof getListKnowledgePages
>;

const DAY_MS = 24 * 60 * 60 * 1000;

const page = (
  id: string,
  updatedAt: number,
  extra: Partial<KnowledgePage> = {}
): KnowledgePage =>
  ({
    displayName: id,
    fullyQualifiedName: id,
    id,
    name: id,
    pageType: PageType.ARTICLE,
    updatedAt,
    ...extra,
  } as KnowledgePage);

const respond = (pages: KnowledgePage[], total = pages.length) =>
  mockList.mockResolvedValue({ data: pages, paging: { total } } as never);

const renderWidget = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <ContextCenterWidget widgetKey="KnowledgePanel.ContextCenter-1" />
    </QueryClientProvider>
  );

describe('ContextCenterWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  // Unsorted, the endpoint returned ten arbitrary pages.
  it('asks for the most recently updated pages, without waiting on the user', async () => {
    respond([]);
    renderWidget();

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith({
        limit: CONTEXT_CENTER_FETCH_LIMIT,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
    );
  });

  it('counts the pages updated inside the week', async () => {
    const now = Date.now();
    respond([page('a', now - DAY_MS), page('b', now - 30 * DAY_MS)], 2);
    renderWidget();

    await waitFor(() =>
      expect(screen.getByTestId('summary')).toHaveTextContent(
        'message.count-pages-updated-this-week {"count":1}'
      )
    );
  });

  it('marks the count as a floor when every fetched page is recent and more exist', async () => {
    const now = Date.now();
    respond(
      Array.from({ length: CONTEXT_CENTER_FETCH_LIMIT }, (_, i) =>
        page(`p${i}`, now - i)
      ),
      40
    );
    renderWidget();

    await waitFor(() =>
      expect(screen.getByTestId('summary')).toHaveTextContent(
        `message.count-plus-pages-updated-this-week {"count":${CONTEXT_CENTER_FETCH_LIMIT}}`
      )
    );
  });

  // The meta used to repeat the summary word for word.
  it('does not repeat the summary in the footer', async () => {
    respond([page('a', Date.now())]);
    renderWidget();

    await screen.findByTestId('context-center-rows');

    expect(screen.queryByTestId('meta')).toBeNull();
  });

  it('translates the page type inside one interpolated subtitle', async () => {
    respond([page('a', Date.now(), { pageType: PageType.QUICK_LINK })]);
    renderWidget();

    expect(
      await screen.findByText(
        'message.page-type-updated-time {"pageType":"label.quick-link","time":"1h"}'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/QuickLink/)).toBeNull();
  });

  it('opens an article through the encoded path helper', async () => {
    respond([page('a1', Date.now(), { fullyQualifiedName: 'team docs/a#1' })]);
    renderWidget();

    fireEvent.click(await screen.findByTestId('context-page-open-a1'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/context-center/articles/team%20docs%2Fa%231'
    );
  });

  it('opens a quick link at its own URL', async () => {
    respond([
      page('q1', Date.now(), {
        page: { url: 'https://example.com/runbook' },
        pageType: PageType.QUICK_LINK,
      }),
    ]);
    renderWidget();

    expect(await screen.findByTestId('context-page-open-q1')).toHaveAttribute(
      'href',
      'https://example.com/runbook'
    );
  });

  it('keeps the row test id alongside the new open-button one', async () => {
    respond([page('a1', Date.now())]);
    renderWidget();

    expect(await screen.findByTestId('context-page-a1')).toContainElement(
      screen.getByTestId('context-page-open-a1')
    );
  });

  it('hands the card its error and claims no "caught up" state', async () => {
    mockList.mockRejectedValue(new Error('network'));
    renderWidget();

    expect(await screen.findByTestId('card-error')).toBeInTheDocument();
    expect(screen.queryByTestId('status')).toBeNull();
    expect(screen.queryByTestId('context-center-empty')).toBeNull();
  });
});
