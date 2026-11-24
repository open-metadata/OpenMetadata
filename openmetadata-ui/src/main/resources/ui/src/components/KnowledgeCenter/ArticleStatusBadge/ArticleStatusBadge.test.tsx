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
import { PageProcessingStatus } from '../../../generated/entity/data/page';
import { PageType } from '../../../interface/knowledge-center.interface';
import ArticleStatusBadge from './ArticleStatusBadge.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest.fn(
    ({ children, color }: { children: React.ReactNode; color: string }) => (
      <span data-color={color}>{children}</span>
    )
  ),
  Tooltip: jest.fn(
    ({ children, title }: { children: React.ReactNode; title: string }) => (
      <span data-testid="tooltip" data-tooltip-title={title}>
        {children}
      </span>
    )
  ),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ArticleStatusBadge', () => {
  it('renders nothing for an article with no status that is not reported as never extracted', () => {
    const { container } = render(<ArticleStatusBadge page={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  // The server owns the rule: an article with a body stays unlabelled without the flag.
  it('does not work out Not processed from the article itself', () => {
    const looksNeverExtracted = {
      description: '<p>GDPR covers the personal data of every EU resident.</p>',
      pageType: PageType.ARTICLE,
      processingStatus: undefined,
    };

    const { container } = render(
      <ArticleStatusBadge page={looksNeverExtracted} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown status value', () => {
    const { container } = render(
      <ArticleStatusBadge
        page={{ processingStatus: 'FutureStatus' as PageProcessingStatus }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the processing error as a tooltip on a Failed badge', () => {
    render(
      <ArticleStatusBadge
        page={{
          processingError: 'provider exploded',
          processingStatus: PageProcessingStatus.Failed,
        }}
      />
    );

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-tooltip-title',
      'provider exploded'
    );
  });

  it('renders no tooltip on a Queued badge', () => {
    render(
      <ArticleStatusBadge
        page={{ processingStatus: PageProcessingStatus.Queued }}
      />
    );

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    expect(screen.getByTestId('article-status-badge')).toHaveTextContent(
      'label.queued'
    );
  });

  it('shows Not processed when the server reports the article was never extracted', () => {
    render(<ArticleStatusBadge page={{ neverExtracted: true }} />);

    const badge = screen.getByTestId('article-status-badge');

    expect(badge).toHaveTextContent('label.not-processed');
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      'gray'
    );
  });

  it.each([
    [PageProcessingStatus.Queued, 'label.queued', 'gray'],
    [PageProcessingStatus.Processing, 'label.processing', 'blue'],
    [PageProcessingStatus.Processed, 'label.processed', 'success'],
    [PageProcessingStatus.Failed, 'label.failed', 'error'],
  ])('renders %s with label %s and color %s', (status, label, color) => {
    render(<ArticleStatusBadge page={{ processingStatus: status }} />);

    const badge = screen.getByTestId('article-status-badge');

    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector('[data-color]')).toHaveAttribute(
      'data-color',
      color
    );
  });
});
