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
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  mockedGlossaryTerms,
  MOCK_GLOSSARY,
} from '../../../mocks/Glossary.mock';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { QueryVoteType } from '../../Database/TableQueries/TableQueries.interface';
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

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>Description</div>);
});

jest.mock('../../Entity/EntityHeader/EntityHeader.component', () => ({
  EntityHeader: jest
    .fn()
    .mockReturnValue(<div data-testid="entity-header">EntityHeader</div>),
}));

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
  '../../../components/Modals/EntityDeleteModal/EntityDeleteModal',
  () => {
    return jest.fn().mockImplementation(() => <p>EntityDeleteModal</p>);
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

jest.mock('../../Modals/StyleModal/StyleModal.component', () => {
  return jest.fn().mockImplementation(() => <p>StyleModal</p>);
});

jest.mock('../../Entity/Voting/Voting.component', () => {
  return jest.fn().mockImplementation(() => <p>Voting</p>);
});
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityVoteStatus: jest.fn().mockReturnValue(QueryVoteType.votedUp),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityDeleteMessage: jest.fn(),
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
  data: { displayName: 'glossaryTest' } as Glossary,
  onUpdate: jest.fn(),
  isVersionView: false,
  type: EntityType.GLOSSARY,
  permissions: DEFAULT_ENTITY_PERMISSION,
};

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
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

    expect(
      screen.queryByText('label.change-parent-entity')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.style')).not.toBeInTheDocument();
  });

  it('should not render import and export dropdown menu items if no permission', async () => {
    mockGlossaryTermPermission.All = false;
    mockGlossaryTermPermission.EditAll = false;
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('should render changeParentHierarchy and style dropdown menu items only for glossaryTerm', async () => {
    mockContext.type = EntityType.GLOSSARY_TERM;
    mockContext.permissions = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };
    mockGlossaryTermPermission.All = true;
    mockGlossaryTermPermission.EditAll = true;
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
});
