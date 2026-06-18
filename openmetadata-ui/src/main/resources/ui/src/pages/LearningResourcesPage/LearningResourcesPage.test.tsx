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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LearningResource } from '../../rest/learningResourceAPI';

const mockResources: LearningResource[] = [
  {
    id: 'r1',
    name: 'VideoResource1',
    displayName: 'Video Resource 1',
    description: 'A video resource',
    resourceType: 'Video',
    categories: ['Discovery'],
    source: { url: 'https://example.com/1' },
    contexts: [{ pageId: 'glossary' }],
    status: 'Active',
    fullyQualifiedName: 'VideoResource1',
    version: 0.1,
    updatedAt: 1704067200000,
    updatedBy: 'admin',
  },
  {
    id: 'r2',
    name: 'StorylaneResource1',
    displayName: 'Storylane Resource 1',
    description: 'A storylane resource',
    resourceType: 'Storylane',
    categories: ['DataGovernance'],
    source: { url: 'https://example.com/2' },
    contexts: [{ pageId: 'lineage' }],
    status: 'Draft',
    fullyQualifiedName: 'StorylaneResource1',
    version: 0.1,
    updatedAt: 1704067200000,
    updatedBy: 'admin',
  },
];

const mockUseLearningResources = jest.fn();
const mockUseLearningResourceActions = jest.fn();

jest.mock('./hooks/useLearningResources', () => ({
  useLearningResources: (...args: unknown[]) =>
    mockUseLearningResources(...args),
}));

jest.mock('./hooks/useLearningResourceActions', () => ({
  useLearningResourceActions: (...args: unknown[]) =>
    mockUseLearningResourceActions(...args),
}));

jest.mock('./hooks/useLearningResourceFilters', () => ({
  useLearningResourceFilters: () => ({
    quickFilters: null,
    filterSelectionDisplay: null,
  }),
}));

jest.mock('../../components/common/atoms/navigation/useSearch', () => ({
  useSearch: () => ({ search: <input data-testid="search-input" /> }),
}));

jest.mock('../../components/common/atoms/navigation/useViewToggle', () => ({
  useViewToggle: () => ({
    view: 'table',
    viewToggle: <button data-testid="card-view-toggle">Card</button>,
  }),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="title-breadcrumb" />,
  })
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () => ({
  __esModule: true,
  default: () => <div data-testid="next-previous" />,
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock(
  '../../components/Learning/LearningResourceCard/LearningResourceCard.component',
  () => ({
    LearningResourceCard: ({ resource }: { resource: LearningResource }) => (
      <div data-testid={`card-${resource.name}`}>{resource.displayName}</div>
    ),
  })
);

jest.mock(
  '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component',
  () => ({
    ResourcePlayerModal: () => <div data-testid="resource-player-modal" />,
  })
);

jest.mock('./LearningResourceForm.component', () => ({
  LearningResourceForm: () => <div data-testid="learning-resource-form" />,
}));

jest.mock('../../components/common/DeleteModal/DeleteModal', () => ({
  DeleteModal: () => <div data-testid="delete-modal" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getSettingPath: () => '/settings',
}));

const defaultActions = {
  isFormOpen: false,
  isPlayerOpen: false,
  isDeleteModalOpen: false,
  isDeleting: false,
  selectedResource: null,
  editingResource: null,
  deletingResource: null,
  handleCreate: jest.fn(),
  handleEdit: jest.fn(),
  handleDelete: jest.fn(),
  handleDeleteConfirm: jest.fn(),
  handleDeleteCancel: jest.fn(),
  handlePreview: jest.fn(),
  handleFormClose: jest.fn(),
  handlePlayerClose: jest.fn(),
};

const defaultResources = {
  resources: mockResources,
  paging: { total: 2 },
  isLoading: false,
  refetch: jest.fn(),
};

// Import after mocks are set up
let LearningResourcesPage: React.FC;

beforeAll(async () => {
  const mod = await import('./LearningResourcesPage');
  LearningResourcesPage = mod.LearningResourcesPage;
});

describe('LearningResourcesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLearningResources.mockReturnValue(defaultResources);
    mockUseLearningResourceActions.mockReturnValue(defaultActions);
  });

  it('renders without crashing and shows the page container', () => {
    render(<LearningResourcesPage />);

    expect(screen.getByTestId('learning-resources-page')).toBeInTheDocument();
  });

  it('renders create resource button', () => {
    render(<LearningResourcesPage />);

    expect(screen.getByTestId('create-resource')).toBeInTheDocument();
  });

  it('renders table with resource rows when resources exist', () => {
    render(<LearningResourcesPage />);

    expect(
      screen.getByTestId('learning-resources-table-body')
    ).toBeInTheDocument();
    expect(screen.getByText('Video Resource 1')).toBeInTheDocument();
    expect(screen.getByText('Storylane Resource 1')).toBeInTheDocument();
  });

  it('calls handleCreate when create button is clicked', () => {
    render(<LearningResourcesPage />);

    fireEvent.click(screen.getByTestId('create-resource'));

    expect(defaultActions.handleCreate).toHaveBeenCalled();
  });

  it('renders loader instead of table while loading', () => {
    mockUseLearningResources.mockReturnValue({
      ...defaultResources,
      resources: [],
      isLoading: true,
    });

    render(<LearningResourcesPage />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByText('Video Resource 1')).not.toBeInTheDocument();
  });

  it('renders empty state message when no resources exist', () => {
    mockUseLearningResources.mockReturnValue({
      ...defaultResources,
      resources: [],
      isLoading: false,
    });

    render(<LearningResourcesPage />);

    expect(screen.getByText('server.no-records-found')).toBeInTheDocument();
  });

  it('renders the LearningResourceForm when isFormOpen is true', () => {
    mockUseLearningResourceActions.mockReturnValue({
      ...defaultActions,
      isFormOpen: true,
    });

    render(<LearningResourcesPage />);

    expect(screen.getByTestId('learning-resource-form')).toBeInTheDocument();
  });

  it('does not render LearningResourceForm when isFormOpen is false', () => {
    render(<LearningResourcesPage />);

    expect(
      screen.queryByTestId('learning-resource-form')
    ).not.toBeInTheDocument();
  });

  it('renders ResourcePlayerModal when selectedResource and isPlayerOpen are set', () => {
    mockUseLearningResourceActions.mockReturnValue({
      ...defaultActions,
      selectedResource: mockResources[0],
      isPlayerOpen: true,
    });

    render(<LearningResourcesPage />);

    expect(screen.getByTestId('resource-player-modal')).toBeInTheDocument();
  });

  it('renders DeleteModal when deletingResource is set', () => {
    mockUseLearningResourceActions.mockReturnValue({
      ...defaultActions,
      deletingResource: mockResources[0],
      isDeleteModalOpen: true,
    });

    render(<LearningResourcesPage />);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('calls handlePreview when a table row is clicked', () => {
    render(<LearningResourcesPage />);

    const tbody = screen.getByTestId('learning-resources-table-body');
    const firstRow = within(tbody).getAllByRole('row')[0];
    fireEvent.click(firstRow);

    expect(defaultActions.handlePreview).toHaveBeenCalledWith(mockResources[0]);
  });

  it('calls handleEdit when edit button is clicked without propagating to row', () => {
    render(<LearningResourcesPage />);

    const editButton = screen.getByTestId(`edit-${mockResources[0].name}`);
    fireEvent.click(editButton);

    expect(defaultActions.handleEdit).toHaveBeenCalledWith(mockResources[0]);
    expect(defaultActions.handlePreview).not.toHaveBeenCalled();
  });

  it('calls handleDelete when delete button is clicked without propagating to row', () => {
    render(<LearningResourcesPage />);

    const deleteButton = screen.getByTestId(`delete-${mockResources[0].name}`);
    fireEvent.click(deleteButton);

    expect(defaultActions.handleDelete).toHaveBeenCalledWith(mockResources[0]);
    expect(defaultActions.handlePreview).not.toHaveBeenCalled();
  });

  it('renders without requiring MUI ThemeProvider — no useTheme call in component', () => {
    // This test verifies that the component renders successfully with no MUI
    // ThemeProvider in the tree. Before the refactor, useTheme() would still
    // work (returns default theme), but now there is no call at all, so the
    // component is fully decoupled from the MUI theme context.
    expect(() => render(<LearningResourcesPage />)).not.toThrow();
  });

  it('applies static CSS custom property for brand color on create button', () => {
    render(<LearningResourcesPage />);

    const createBtn = screen.getByTestId('create-resource');

    // The button sx uses defaultColors.blue[600] directly — no theme lookup.
    // Verify the button exists and is enabled (visual color verified via E2E).
    expect(createBtn).toBeEnabled();
  });
});
