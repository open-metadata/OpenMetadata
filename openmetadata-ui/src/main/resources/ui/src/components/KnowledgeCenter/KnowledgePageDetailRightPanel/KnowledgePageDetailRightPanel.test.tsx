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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { PageProcessingStatus } from '../../../generated/entity/data/page';
import {
  KnowledgePage,
  PageType,
} from '../../../interface/knowledge-center.interface';
import KnowledgePageDetailRightPanel from './KnowledgePageDetailRightPanel';

jest.mock('@openmetadata/ui-core-components', () => ({
  Card: Object.assign(
    jest.fn(
      ({
        children,
        'data-testid': testId,
      }: {
        children: React.ReactNode;
        'data-testid'?: string;
      }) => <div data-testid={testId}>{children}</div>
    ),
    {
      Content: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    }
  ),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

jest.mock(
  '../../../components/Customization/GenericProvider/GenericContext',
  () => ({
    useGenericContext: jest.fn(() => ({
      entityRules: {},
      isRulesLoaded: true,
      data: {},
      onUpdate: jest.fn(),
      permissions: { EditAll: true },
    })),
  })
);

jest.mock(
  '../../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2',
  () => ({
    ReviewerLabelV2: jest.fn(() => <div data-testid="reviewer-label" />),
  })
);

jest.mock(
  '../../../components/DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => jest.fn(() => <div data-testid="data-products" />)
);

jest.mock('../../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn(() => <div data-testid="tags-container" />)
);

jest.mock('../RelatedDataAssets/RelatedDataAssets', () =>
  jest.fn(() => <div data-testid="related-data-assets" />)
);

jest.mock('../AttachmentWidget/AttachmentWidget', () =>
  jest.fn(() => <div data-testid="attachment-widget" />)
);

jest.mock('../ArticleStatusBadge/ArticleStatusBadge.component', () =>
  jest.fn(({ status, error }: { status?: string; error?: string }) => (
    <span data-error={error} data-status={status} data-testid="status-badge" />
  ))
);

jest.mock(
  '../../ContextCenter/ExtractedMemoriesCard/ExtractedMemoriesCard.component',
  () =>
    jest.fn(({ sourceId }: { sourceId: string }) => (
      <div data-source-id={sourceId} data-testid="extracted-memories-card" />
    ))
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const article = {
  id: 'page-1',
  name: 'gdpr',
  fullyQualifiedName: 'gdpr',
  version: 0.1,
  updatedAt: 1,
  updatedBy: 'admin',
  href: 'http://x',
  pageType: PageType.ARTICLE,
  page: { publicationDate: new Date(), relatedArticles: [] },
  deleted: false,
} as KnowledgePage;

const renderPanel = (knowledgePage?: KnowledgePage) =>
  render(
    <KnowledgePageDetailRightPanel
      handleRelatedEntitiesUpdate={jest.fn()}
      knowledgePage={knowledgePage}
      permissions={{ EditAll: true } as OperationPermission}
      tags={[]}
      updatePageTag={jest.fn()}
    />
  );

describe('KnowledgePageDetailRightPanel', () => {
  it('lists the memories extracted from the article', () => {
    renderPanel(article);

    expect(screen.getByTestId('extracted-memories-card')).toHaveAttribute(
      'data-source-id',
      'page-1'
    );
  });

  it('shows the extraction status badge once the article has a status', () => {
    renderPanel({
      ...article,
      processingStatus: PageProcessingStatus.Queued,
    });

    expect(screen.getByTestId('status-badge')).toHaveAttribute(
      'data-status',
      'Queued'
    );
  });

  it('passes the processing error through to the badge', () => {
    renderPanel({
      ...article,
      processingStatus: PageProcessingStatus.Failed,
      processingError: 'provider exploded',
    });

    expect(screen.getByTestId('status-badge')).toHaveAttribute(
      'data-error',
      'provider exploded'
    );
  });

  it('hides the status row until an extraction run has been recorded', () => {
    renderPanel(article);

    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('renders neither the status row nor the memories card without a page', () => {
    renderPanel();

    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('extracted-memories-card')
    ).not.toBeInTheDocument();
  });
});
