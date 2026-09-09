import { render, screen } from '@testing-library/react';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
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
    useGenericContext: jest.fn(),
  })
);

// The permission-forwarding mocks below double as the plain render stubs the
// extraction suite needs — it only asserts on the badge and the memories card,
// so the extra data-* attributes are inert there.
jest.mock(
  '../../../components/DataProducts/DataProductsContainer/DataProductsContainer.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ hasPermission }) => (
        <div
          data-has-permission={String(Boolean(hasPermission))}
          data-testid="data-products-container"
        />
      ))
);

jest.mock('../../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest
    .fn()
    .mockImplementation(({ permission, tagType }) => (
      <div
        data-permission={String(Boolean(permission))}
        data-testid={`tags-container-${tagType}`}
      />
    ))
);

jest.mock('../RelatedDataAssets/RelatedDataAssets', () =>
  jest
    .fn()
    .mockImplementation(({ hasPermission }) => (
      <div
        data-has-permission={String(Boolean(hasPermission))}
        data-testid="related-data-assets"
      />
    ))
);

jest.mock('../AttachmentWidget/AttachmentWidget', () =>
  jest.fn(() => <div data-testid="attachment-widget" />)
);

jest.mock(
  '../../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2',
  () => ({
    ReviewerLabelV2: jest.fn(() => <div data-testid="reviewer-label" />),
  })
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

const mockUseGenericContext = useGenericContext as jest.Mock;

const setContext = (
  permissions: Partial<OperationPermission>,
  deleted = false
) => {
  mockUseGenericContext.mockReturnValue({
    entityRules: {},
    isRulesLoaded: true,
    data: { deleted, domains: [], dataProducts: [] },
    onUpdate: jest.fn(),
    permissions,
  });
};

// clearAllMocks wipes the return value too, so the default has to be re-seeded
// after it — the extraction suite below never sets a context of its own.
beforeEach(() => {
  jest.clearAllMocks();
  setContext({ EditAll: true });
});

const defaultProps = {
  tags: [],
  updatePageTag: jest.fn(),
  handleRelatedEntitiesUpdate: jest.fn(),
};

const renderComponent = (
  permissions: Partial<OperationPermission>,
  deleted = false
) => {
  setContext(permissions, deleted);

  return render(
    <KnowledgePageDetailRightPanel
      {...defaultProps}
      permissions={permissions as OperationPermission}
    />
  );
};

describe('KnowledgePageDetailRightPanel permissions', () => {
  it('grants edit access when EditAll is true', () => {
    renderComponent({ EditAll: true, EditTags: true });

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'true'
    );
    expect(screen.getByTestId('tags-container-Classification')).toHaveAttribute(
      'data-permission',
      'true'
    );
    expect(screen.getByTestId('tags-container-Glossary')).toHaveAttribute(
      'data-permission',
      'true'
    );
    expect(screen.getByTestId('related-data-assets')).toHaveAttribute(
      'data-has-permission',
      'true'
    );
  });

  it('denies tags edit when EditTags is explicitly false even though EditAll is true (explicit-deny-wins, prioritized over the old raw OR)', () => {
    renderComponent({ EditAll: true, EditTags: false });

    expect(screen.getByTestId('tags-container-Classification')).toHaveAttribute(
      'data-permission',
      'false'
    );
    expect(screen.getByTestId('tags-container-Glossary')).toHaveAttribute(
      'data-permission',
      'false'
    );
  });

  it('denies every edit-gated affordance once the entity is deleted, even with EditAll granted', () => {
    renderComponent({ EditAll: true, EditTags: true }, true);

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'false'
    );
    expect(screen.getByTestId('tags-container-Classification')).toHaveAttribute(
      'data-permission',
      'false'
    );
    expect(screen.getByTestId('related-data-assets')).toHaveAttribute(
      'data-has-permission',
      'false'
    );
  });
});

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
