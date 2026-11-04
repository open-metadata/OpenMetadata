/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { QueryVoteType } from '../../../interface/entity/vote.interface';
import {
  mockedGlossaryTerms,
  MOCK_GLOSSARY,
} from '../../../mocks/Glossary.mock';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import { Task } from '../../../rest/tasksAPI';
import { GlossaryProposal } from '../../../utils/GlossaryReview/GlossaryReview.types';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import GlossaryHeader from './GlossaryHeader.component';

const mockGlossaryTermPermission = {
  All: true,
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      glossaryTerm: mockGlossaryTermPermission,
    },
  })),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    glossaryFqn: 'glossaryFqn',
    action: 'action',
  }),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    'data-testid'?: string;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const mockDerivation = {
  entity: { id: 'term-id', type: 'glossaryTerm' },
  memory: {
    id: 'memory-id',
    type: 'contextMemory',
    name: 'churn',
    displayName: 'Churn memory',
  },
  evidence: {
    agent: 'Glossary Agent',
    confidence: 0.92,
    reasons: ['Defines a recurring customer metric'],
  },
};

const mockDecide = jest.fn();
const mockLoadedProposal: { current?: GlossaryProposal } = {};

jest.mock('../../../hooks/governance/glossary/useGlossaryProposals', () => ({
  useDecideProposal: jest.fn(() => mockDecide),
  useGlossaryProposal: jest.fn(() => mockLoadedProposal.current),
}));

jest.mock(
  '../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => {
    return {
      UserTeamSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
        <div>
          <p>UserTeamSelectableList</p>
          <button data-testid="update" onClick={onUpdate}>
            update
          </button>
        </div>
      )),
    };
  }
);

jest.mock('../../common/EntityDescription/Description', () => {
  return jest.fn().mockImplementation(() => <div>Description</div>);
});

jest.mock('../../Entity/EntityHeaderTitle/EntityHeaderTitle.component', () =>
  jest.fn().mockReturnValue(<div data-testid="entity-header">EntityHeader</div>)
);

jest.mock(
  '../../Modals/ChangeParentHierarchy/ChangeParentHierarchy.component',
  () => {
    return jest.fn().mockImplementation(({ onCancel }) => (
      <div data-testid="glossary-change-parent-modal">
        <span>ChangeParentHierarchyComponent</span>
        <button onClick={onCancel}>Cancel_Button</button>
      </div>
    ));
  }
);

jest.mock(
  '../../../components/Modals/EntityNameModal/EntityNameModal.component',
  () => {
    return jest.fn().mockImplementation(() => <p>EntityNameModal</p>);
  }
);

jest.mock(
  '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(({ name }) => <div>{name}</div>),
  })
);

jest.mock(
  '../../../components/common/StatusBadge/StatusBadge.component',
  () => {
    return jest.fn().mockImplementation(() => <p>StatusBadge</p>);
  }
);

jest.mock('../../Modals/IconColorModal/IconColorModal', () => {
  return jest.fn().mockImplementation(() => <p>IconColorModal</p>);
});

jest.mock('../../Entity/Voting/Voting.component', () => {
  return jest.fn().mockImplementation(() => <p>Voting</p>);
});
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityVoteUtils', () => ({
  getEntityVoteStatus: jest.fn().mockReturnValue(QueryVoteType.votedUp),
}));

jest.mock('../../../utils/EntityDisplayPureUtils', () => ({
  getEntityDeleteMessage: jest.fn(),
}));
const mockIsAiMode = jest.fn().mockReturnValue(false);

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode(),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue('glossary.test1'),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getGlossaryPath: jest.fn(),
  getGlossaryPathWithAction: jest.fn(),
  getGlossaryTermsVersionsPath: jest.fn(),
  getGlossaryVersionsPath: jest.fn(),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  exportGlossaryInCSVFormat: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getGlossariesById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  getGlossaryTermsById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  moveGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const mockOnDelete = jest.fn();
const mockOnUpdateVote = jest.fn();

const mockContext = {
  data: { displayName: 'glossaryTest' } as Glossary | GlossaryTerm,
  onUpdate: jest.fn(),
  isVersionView: false,
  type: EntityType.GLOSSARY,
  permissions: DEFAULT_ENTITY_PERMISSION,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => mockContext),
}));

describe('GlossaryHeader component', () => {
  it('should render name of Glossary', () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('EntityHeader')).toBeInTheDocument();
  });

  it.each([
    [false, false],
    [true, true],
  ])(
    'should render the breadcrumb ending with the current entity, inside the header card only in AI mode (AI mode: %s)',
    (isAiMode, isInsideHeader) => {
      const originalData = mockContext.data;
      mockContext.data = {
        ...originalData,
        name: 'glossaryTest',
        fullyQualifiedName: 'glossaryTest',
      };
      mockIsAiMode.mockReturnValue(isAiMode);

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      const breadcrumb = screen.getByTestId('breadcrumb');

      expect(breadcrumb).toHaveTextContent('glossaryTest');
      expect(screen.getByTestId('glossary-header').contains(breadcrumb)).toBe(
        isInsideHeader
      );
      expect(screen.queryByRole('link', { name: 'label.home' }) !== null).toBe(
        !isAiMode
      );

      mockContext.data = originalData;
      mockIsAiMode.mockReturnValue(false);
    }
  );

  it.each([
    [true, true],
    [false, false],
  ])(
    'should render the gradient header background only in AI mode (AI mode: %s)',
    (isAiMode, hasGradient) => {
      mockIsAiMode.mockReturnValue(isAiMode);

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      expect(
        screen
          .getByTestId('glossary-header')
          .className.includes('linear-gradient')
      ).toBe(hasGradient);

      mockIsAiMode.mockReturnValue(false);
    }
  );

  it('should render import and export dropdown menu items only for glossary', async () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.queryByText('label.import')).toBeInTheDocument();
    expect(screen.queryByText('label.export')).toBeInTheDocument();
    expect(screen.queryByText('label.import-ontology')).toBeInTheDocument();

    expect(
      screen.queryByText('label.change-parent-entity')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.style')).not.toBeInTheDocument();
  });

  it('should not render import and export dropdown menu items if no permission', async () => {
    mockGlossaryTermPermission.All = false;
    mockGlossaryTermPermission[Operation.EditAll] = false;
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('should hide the import ontology action when the user lacks import/export permission', async () => {
    // Import/export permission is off, but display-name edit is on — so the
    // manage menu still opens and we are testing the per-item gate, not the
    // whole-menu gate.
    mockContext.type = EntityType.GLOSSARY;
    mockContext.permissions = {
      ...DEFAULT_ENTITY_PERMISSION,
      EditDisplayName: true,
    };
    mockGlossaryTermPermission.All = false;
    mockGlossaryTermPermission[Operation.EditAll] = false;

    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.queryByText('label.import-ontology')).not.toBeInTheDocument();
    expect(screen.queryByText('label.import')).not.toBeInTheDocument();
    expect(screen.queryByText('label.export')).not.toBeInTheDocument();

    mockContext.permissions = DEFAULT_ENTITY_PERMISSION;
    mockGlossaryTermPermission.All = true;
    mockGlossaryTermPermission[Operation.EditAll] = true;
  });

  it('should render changeParentHierarchy and style dropdown menu items only for glossaryTerm', async () => {
    mockContext.type = EntityType.GLOSSARY_TERM;
    mockContext.permissions = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };
    mockGlossaryTermPermission.All = true;
    mockGlossaryTermPermission[Operation.EditAll] = true;
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.getByText('label.style')).toBeInTheDocument();
    expect(screen.getByText('label.change-parent-entity')).toBeInTheDocument();

    expect(screen.queryByText('label.import')).not.toBeInTheDocument();
    expect(screen.queryByText('label.export')).not.toBeInTheDocument();
  });

  it('should not render ChangeParentHierarchy component when it is close', () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();
  });

  it('should render ChangeParentHierarchy component after clicking dropdown menu item', async () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.change-parent-entity'));
    });

    expect(
      screen.getByText('ChangeParentHierarchyComponent')
    ).toBeInTheDocument();
  });

  it('should not render ChangeParentHierarchy component after onCancel call', async () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.change-parent-entity'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel_Button'));
    });

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();
  });

  describe('import/export visibility with conditional policies', () => {
    it('should show import/export when globalPermissions denies but entity-level permissions allow (isOwner condition satisfied)', async () => {
      // Simulate a conditional policy: resource-level check returns false because
      // the backend cannot evaluate isOwner() without entity context.
      mockGlossaryTermPermission.All = false;
      mockGlossaryTermPermission[Operation.EditAll] = false;

      // Entity-level permissions are fetched with the glossary ID so the backend
      // correctly evaluates isOwner() and returns Allow.
      mockContext.type = EntityType.GLOSSARY;
      mockContext.permissions = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.queryByText('label.import')).toBeInTheDocument();
      expect(screen.queryByText('label.export')).toBeInTheDocument();
    });

    it('should hide import/export when both globalPermissions and entity-level permissions deny', async () => {
      // Both resource-level and entity-level permissions deny — user is not the
      // owner and no other condition grants access.
      mockGlossaryTermPermission.All = false;
      mockGlossaryTermPermission[Operation.EditAll] = false;

      mockContext.type = EntityType.GLOSSARY;
      mockContext.permissions = {
        ...DEFAULT_ENTITY_PERMISSION,
        All: false,
        EditAll: false,
      };

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
    });
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 4):
  // an explicit EditDisplayName: false must win over a bare EditAll grant
  // (explicit-deny-wins, Task 6 Finding 1) — the old raw
  // `permissions.EditAll || permissions.EditDisplayName` let EditAll grant
  // unconditionally. Self-contained (explicit setup + reset), matching the
  // 'import/export visibility with conditional policies' block above rather than the
  // implicit state-leak pattern some earlier tests in this file rely on.
  describe('rename menu item explicit-deny-wins', () => {
    afterEach(() => {
      mockContext.permissions = DEFAULT_ENTITY_PERMISSION;
      mockContext.type = EntityType.GLOSSARY;
      mockGlossaryTermPermission.All = true;
      mockGlossaryTermPermission[Operation.EditAll] = true;
    });

    it('denies the rename menu item when EditDisplayName is explicitly false, even with EditAll true', async () => {
      mockContext.type = EntityType.GLOSSARY_TERM;
      mockContext.permissions = {
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: true,
        EditDisplayName: false,
      };
      mockGlossaryTermPermission.All = false;
      mockGlossaryTermPermission[Operation.EditAll] = false;

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.queryByText('label.rename')).not.toBeInTheDocument();
      // EditAll still independently grants the style/change-parent menu items.
      expect(screen.getByText('label.style')).toBeInTheDocument();
    });

    it('renders the rename menu item when EditDisplayName is true, even with EditAll false', async () => {
      mockContext.type = EntityType.GLOSSARY_TERM;
      mockContext.permissions = {
        ...DEFAULT_ENTITY_PERMISSION,
        EditDisplayName: true,
      };
      mockGlossaryTermPermission.All = false;
      mockGlossaryTermPermission[Operation.EditAll] = false;

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.getByText('label.rename')).toBeInTheDocument();
    });
  });

  describe('AI-generated drafts', () => {
    const aiDraft = {
      id: 'term-id',
      name: 'churn',
      displayName: 'Churn',
      description: 'Customers who cancel every subscription.',
      glossary: { id: 'glossary-id', type: EntityType.GLOSSARY },
      provider: ProviderType.Automation,
      entityStatus: EntityStatus.Draft,
      updatedAt: Date.now(),
    } as GlossaryTerm;

    const inReview = { ...aiDraft, entityStatus: EntityStatus.InReview };
    const approvalRequest = {
      id: 'task-id',
      about: { fullyQualifiedName: 'Customers.churn', type: 'glossaryTerm' },
      assignees: [{ id: mockUserData.id, name: 'admin', type: 'user' }],
    } as unknown as Task;

    beforeEach(() => {
      mockContext.type = EntityType.GLOSSARY_TERM;
      mockContext.permissions = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };
      mockContext.onUpdate = jest.fn().mockResolvedValue(undefined);
      mockDecide.mockReset().mockResolvedValue(true);
      mockLoadedProposal.current = undefined;
    });

    it('approves an AI proposal through its approval request from its card', async () => {
      const onProposalDecided = jest.fn();
      mockContext.data = inReview;
      mockLoadedProposal.current = {
        approvalTask: approvalRequest,
        derivation: mockDerivation,
        source: 'ai',
        term: { ...inReview, fullyQualifiedName: 'Customers.churn' },
      };

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
          onProposalDecided={onProposalDecided}
        />
      );

      expect(screen.getByTestId('ai-generated-term-card')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(
        screen.getByText('Defines a recurring customer metric')
      ).toBeInTheDocument();
      expect(screen.getByTestId('proposal-source-memory')).toHaveAttribute(
        'href',
        expect.stringContaining('memory=churn')
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('approve-proposal'));
      });

      expect(mockDecide).toHaveBeenCalledWith(
        mockLoadedProposal.current,
        EntityStatus.Approved,
        undefined
      );
      expect(mockContext.onUpdate).not.toHaveBeenCalled();
      expect(onProposalDecided).toHaveBeenCalled();
    });

    it('waits for the approval request before anyone decides an AI draft', () => {
      mockContext.data = aiDraft;
      mockLoadedProposal.current = { source: 'ai', term: aiDraft };

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByTestId('ai-generated-term-card')).toBeInTheDocument();
      expect(screen.queryByTestId('approve-proposal')).not.toBeInTheDocument();
      expect(
        screen.getByText('message.waiting-for-approval-request')
      ).toBeInTheDocument();
    });

    it('shows no card until the proposal and its approval request load', () => {
      mockContext.data = aiDraft;

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      expect(
        screen.queryByTestId('ai-generated-term-card')
      ).not.toBeInTheDocument();
    });

    it('shows no card once the term is approved or a person-made draft', () => {
      mockContext.data = { ...aiDraft, entityStatus: EntityStatus.Approved };
      const { rerender } = render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      expect(
        screen.queryByTestId('ai-generated-term-card')
      ).not.toBeInTheDocument();

      mockContext.data = { ...aiDraft, provider: ProviderType.User };
      rerender(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      expect(
        screen.queryByTestId('ai-generated-term-card')
      ).not.toBeInTheDocument();
    });
  });
});
