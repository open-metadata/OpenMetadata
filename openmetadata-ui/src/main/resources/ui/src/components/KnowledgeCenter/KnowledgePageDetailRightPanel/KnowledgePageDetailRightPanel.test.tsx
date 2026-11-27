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
import { Tooltip } from '@openmetadata/ui-core-components';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import DataProductsContainer from '../../../components/DataProducts/DataProductsContainer/DataProductsContainer.component';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Reason } from '../../../generated/api/context/extractionAvailability';
import { PageProcessingStatus } from '../../../generated/entity/data/page';
import { User } from '../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  KnowledgePage,
  PageType,
} from '../../../interface/knowledge-center.interface';
import { getExtractionAvailability } from '../../../rest/contextMemoryAPI';
import {
  extractPageMemories,
  getKnowledgePageByFqn,
} from '../../../rest/knowledgeCenterAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../test/unit/test-utils';
import { getEntityRulesValidation } from '../../../utils/RuleEnforcementUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import KnowledgePageDetailRightPanel from './KnowledgePageDetailRightPanel';

jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  ...jest.requireActual('../../../rest/knowledgeCenterAPI'),
  extractPageMemories: jest.fn(),
  getKnowledgePageByFqn: jest.fn(),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getExtractionAvailability: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      isDisabled,
      isLoading,
      onClick,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      isDisabled?: boolean;
      isLoading?: boolean;
      onClick?: () => void;
      'data-testid'?: string;
    }) => (
      <button
        data-loading={isLoading ? 'true' : undefined}
        data-testid={testId}
        disabled={isDisabled || isLoading}
        onClick={onClick}>
        {children}
      </button>
    )
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
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
  jest.fn(
    ({
      page,
    }: {
      page: {
        neverExtracted?: boolean;
        processingError?: string;
        processingStatus?: string;
      };
    }) => (
      <span
        data-error={page.processingError}
        data-never-extracted={page.neverExtracted}
        data-status={page.processingStatus}
        data-testid="status-badge"
      />
    )
  )
);

jest.mock(
  '../../ContextCenter/ExtractedMemoriesCard/ExtractedMemoriesCard.component',
  () =>
    jest.fn(
      ({
        sourceId,
        sourceOwners,
        sourceType,
      }: {
        sourceId: string;
        sourceOwners?: { id: string }[];
        sourceType: string;
      }) => (
        <div
          data-owner-ids={sourceOwners?.map((owner) => owner.id).join(',')}
          data-source-id={sourceId}
          data-source-type={sourceType}
          data-testid="extracted-memories-card"
        />
      )
    )
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

runQueryNotificationsSynchronously();

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
  onExtractionStateChange: jest.fn(),
};

const renderComponent = (
  permissions: Partial<OperationPermission>,
  deleted = false
) => {
  setContext(permissions, deleted);

  return renderWithQueryClient(
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

const renderPanel = (
  knowledgePage?: KnowledgePage,
  onExtractionStateChange = jest.fn()
) =>
  renderWithQueryClient(
    <KnowledgePageDetailRightPanel
      handleRelatedEntitiesUpdate={jest.fn()}
      knowledgePage={knowledgePage}
      permissions={{ EditAll: true } as OperationPermission}
      tags={[]}
      updatePageTag={jest.fn()}
      onExtractionStateChange={onExtractionStateChange}
    />
  );

const mockGenericContext = (
  overrides: Partial<ReturnType<typeof useGenericContext>>
) =>
  (useGenericContext as jest.Mock).mockReturnValue({
    entityRules: {},
    isRulesLoaded: true,
    data: {},
    onUpdate: jest.fn(),
    permissions: { EditAll: true },
    ...overrides,
  });

const lastDataProductsProps = () =>
  (DataProductsContainer as jest.Mock).mock.calls.at(-1)?.[0];

describe('KnowledgePageDetailRightPanel', () => {
  beforeEach(() => {
    (DataProductsContainer as jest.Mock).mockClear();
    mockGenericContext({});
  });

  it('holds single-select while entity rules are loading', () => {
    mockGenericContext({
      entityRules: {
        ...getEntityRulesValidation([], EntityType.PAGE),
        canAddMultipleDataProducts: true,
      },
      isRulesLoaded: false,
    });

    renderPanel(article);

    expect(lastDataProductsProps()).toMatchObject({ multiple: false });
  });

  it('enables multi-select once rules are loaded and allow multiple products', () => {
    mockGenericContext({
      entityRules: {
        ...getEntityRulesValidation([], EntityType.PAGE),
        canAddMultipleDataProducts: true,
      },
      isRulesLoaded: true,
    });

    renderPanel(article);

    expect(lastDataProductsProps()).toMatchObject({ multiple: true });
  });

  it('keeps single-select when loaded rules disallow multiple products', () => {
    mockGenericContext({
      entityRules: {
        ...getEntityRulesValidation([], EntityType.PAGE),
        canAddMultipleDataProducts: false,
      },
      isRulesLoaded: true,
    });

    renderPanel(article);

    expect(lastDataProductsProps()).toMatchObject({ multiple: false });
  });

  it('lists the memories extracted from the article', () => {
    renderPanel(article);

    expect(screen.getByTestId('extracted-memories-card')).toHaveAttribute(
      'data-source-id',
      'page-1'
    );
  });

  // The card offers the article's owners the approval of its extracted memories.
  it('names the article and its owners to the memories card', () => {
    renderPanel({
      ...article,
      owners: [{ id: 'team-finance', type: 'team', name: 'finance' }],
    });

    const card = screen.getByTestId('extracted-memories-card');

    expect(card).toHaveAttribute('data-source-type', 'page');
    expect(card).toHaveAttribute('data-owner-ids', 'team-finance');
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

  // The server owns the rule: a body alone does not make the article Not processed.
  it('hides the status row until the article has a status or is reported never extracted', () => {
    renderPanel({
      ...article,
      description: '<p>GDPR covers the personal data of every EU resident.</p>',
    });

    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
  });

  it('shows the status row for an article the server reports as never extracted', () => {
    renderPanel({ ...article, neverExtracted: true });

    expect(screen.getByText('label.memory-extraction')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveAttribute(
      'data-never-extracted',
      'true'
    );
  });

  it('renders neither the status row nor the memories card without a page', () => {
    renderPanel();

    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('extracted-memories-card')
    ).not.toBeInTheDocument();
  });
});

const OWNER: User = {
  id: 'user-alice',
  name: 'alice',
  email: 'alice@example.com',
};

const notExtractedArticle: KnowledgePage = {
  ...article,
  description: '<p>GDPR covers the personal data of every EU resident.</p>',
  neverExtracted: true,
  owners: [{ id: OWNER.id, type: 'user', name: OWNER.name }],
};

const failedArticle: KnowledgePage = {
  ...notExtractedArticle,
  neverExtracted: false,
  processingError: 'Provider exploded',
  processingStatus: PageProcessingStatus.Failed,
};

const httpError = (status: number, message: string) =>
  new AxiosError(message, undefined, undefined, undefined, {
    status,
    data: { code: status, message },
  } as AxiosResponse);

const extractionButton = () => screen.getByTestId('memory-extraction-btn');

// The availability read settles inside the act, so no assertion runs on a half-rendered panel.
const renderExtractionPanel = async (
  knowledgePage: KnowledgePage,
  onExtractionStateChange = jest.fn()
) => {
  await act(async () => {
    renderPanel(knowledgePage, onExtractionStateChange);
  });
};

describe('KnowledgePageDetailRightPanel — Extract and Retry', () => {
  beforeEach(() => {
    mockGenericContext({});
    useApplicationStore.setState({ currentUser: OWNER });
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: true,
    });
  });

  // RTL unmounts after this hook, so the sign-out still re-renders the tree.
  afterEach(() => {
    act(() => {
      useApplicationStore.setState({ currentUser: undefined });
    });
  });

  it('offers Extract beside the status of an article never extracted, to its owner', async () => {
    await renderExtractionPanel(notExtractedArticle);

    expect(extractionButton()).toHaveTextContent('label.extract');
  });

  it('offers Retry on a failed article to an admin who does not own it', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-root', name: 'root', isAdmin: true },
    });
    await renderExtractionPanel(failedArticle);

    expect(extractionButton()).toHaveTextContent('label.retry');
  });

  it('offers nothing to a user who neither owns the article nor is an admin', async () => {
    useApplicationStore.setState({
      currentUser: { ...OWNER, id: 'user-bob', name: 'bob' },
    });
    await renderExtractionPanel(notExtractedArticle);

    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-extraction-btn')
    ).not.toBeInTheDocument();
  });

  it('offers nothing on an archived article', async () => {
    await renderExtractionPanel({ ...failedArticle, deleted: true });

    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-extraction-btn')
    ).not.toBeInTheDocument();
  });

  it('disables it with the reason while extraction is off', async () => {
    (getExtractionAvailability as jest.Mock).mockResolvedValue({
      available: false,
      reason: Reason.ExtractionDisabled,
    });
    await renderExtractionPanel(notExtractedArticle);

    await waitFor(() =>
      expect(Tooltip).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'message.memory-extraction-off' }),
        expect.anything()
      )
    );

    expect(extractionButton()).toBeDisabled();
  });

  // The run waits out the article's quiet period, so the response reads Queued.
  it('requests the extraction and hands back the article the server returns', async () => {
    const queued: KnowledgePage = {
      ...notExtractedArticle,
      neverExtracted: false,
      processingStatus: PageProcessingStatus.Queued,
    };
    (extractPageMemories as jest.Mock).mockResolvedValue(queued);
    const onExtractionStateChange = jest.fn();
    await renderExtractionPanel(notExtractedArticle, onExtractionStateChange);

    fireEvent.click(extractionButton());

    await waitFor(() =>
      expect(onExtractionStateChange).toHaveBeenCalledWith(queued)
    );

    expect(extractPageMemories).toHaveBeenCalledWith('page-1');
  });

  it.each([
    [
      409,
      'This document’s memories are already queued or being extracted.',
      'message.memory-extraction-cannot-start',
    ],
    [
      503,
      'Memory extraction could not be queued.',
      'message.memory-extraction-not-queued',
    ],
  ])(
    'says why after a %s, in the user’s language, and hands back a fresh read of the article',
    async (status, serverMessage, messageKey) => {
      (extractPageMemories as jest.Mock).mockRejectedValue(
        httpError(status, serverMessage)
      );
      (getKnowledgePageByFqn as jest.Mock).mockResolvedValue(failedArticle);
      const onExtractionStateChange = jest.fn();
      await renderExtractionPanel(notExtractedArticle, onExtractionStateChange);

      fireEvent.click(extractionButton());

      await waitFor(() =>
        expect(onExtractionStateChange).toHaveBeenCalledWith(failedArticle)
      );
      await waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith(messageKey)
      );

      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(getKnowledgePageByFqn).toHaveBeenCalledWith('gdpr', {
        fields: 'neverExtracted',
      });
    }
  );
});
