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

import { render, screen, waitFor } from '@testing-library/react';
import { LearningResource } from '../../../rest/learningResourceAPI';
import { ArticleViewer } from './ArticleViewer.component';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewer', () => {
  return jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rich-text-previewer">{markdown}</div>
    ));
});

const createMockResource = (
  url: string,
  embedContent?: string
): LearningResource => ({
  id: 'test-id',
  name: 'test-article',
  displayName: 'Test Article',
  resourceType: 'Article',
  source: {
    url,
    embedConfig: embedContent ? { content: embedContent } : undefined,
  },
  contexts: [{ pageId: 'glossary' }],
});

describe('ArticleViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    const resource = createMockResource('https://example.com/article.md');
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<ArticleViewer resource={resource} />);

    expect(screen.getByText('label.loading-article')).toBeInTheDocument();
  });

  it('should render embedded content from embedConfig', async () => {
    const embeddedContent = '# Test Article Content';
    const resource = createMockResource('https://example.com', embeddedContent);

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    });

    expect(screen.getByText(embeddedContent)).toBeInTheDocument();
  });

  it('should fetch and render content from URL', async () => {
    const resource = createMockResource('https://example.com/article.md');
    const fetchedContent = '# Fetched Article';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(fetchedContent),
    });

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    });

    expect(screen.getByText(fetchedContent)).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    const resource = createMockResource('https://example.com/article.md');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(
        screen.getByText('message.failed-to-load-article')
      ).toBeInTheDocument();
    });
  });

  it('should render error state when fetch throws', async () => {
    const resource = createMockResource('https://example.com/article.md');

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(
        screen.getByText('message.failed-to-load-article')
      ).toBeInTheDocument();
    });
  });

  it('should render URL directly if not http URL and no embedConfig', async () => {
    const resource = createMockResource('Some direct markdown content');

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Some direct markdown content')
    ).toBeInTheDocument();
  });

  it('should show open original link button on error', async () => {
    const resource = createMockResource('https://example.com/article.md');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(screen.getByText('label.open-original')).toBeInTheDocument();
    });
  });

  it('should prioritize embedConfig over URL fetch', async () => {
    const embeddedContent = '# Embedded Content';
    const resource = createMockResource(
      'https://example.com/article.md',
      embeddedContent
    );

    render(<ArticleViewer resource={resource} />);

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText(embeddedContent)).toBeInTheDocument();
  });
});
