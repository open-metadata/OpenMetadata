/* eslint-disable jest/no-disabled-tests */
/*
 *  Copyright 2022 Collate.
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

import { ThemeProvider } from '@mui/material';
import { createMuiTheme } from '@openmetadata/ui-core-components';
import {
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  getByText,
  queryByTitle,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResizableLeftPanels from '../../components/common/ResizablePanels/ResizableLeftPanels';
import { deleteTag, getAllClassifications } from '../../rest/tagAPI';
import { checkPermission } from '../../utils/PermissionsUtils';
import { descriptionTableObject } from '../../utils/TableColumn.util';
import { getClassifications } from '../../utils/TagsUtils';
import TagsPage from './TagsPage';
import {
  MOCK_ALL_CLASSIFICATIONS,
  MOCK_DELETE_CLASSIFICATION,
  MOCK_DELETE_TAG,
  MOCK_TAGS,
  MOCK_TAGS_CATEGORY,
} from './TagsPage.mock';

jest.mock('@openmetadata/ui-core-components', () => {
  const { createTheme } = jest.requireActual('@mui/material/styles');

  return {
    Toggle: ({
      children,
      onChange,
      isSelected,
      isDisabled,
      ...props
    }: {
      children?: React.ReactNode;
      onChange?: (v: boolean) => void;
      isSelected?: boolean;
      isDisabled?: boolean;
      [key: string]: unknown;
    }) => (
      <button
        aria-checked={isSelected}
        disabled={isDisabled}
        role="switch"
        onClick={() => onChange?.(!isSelected)}
        {...props}>
        {children}
      </button>
    ),
    Tooltip: ({
      children,
      title,
    }: {
      children: React.ReactNode;
      title?: React.ReactNode;
    }) => <div title={title as string}>{children}</div>,
    TooltipTrigger: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <button className={className}>{children}</button>,
    Badge: ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={testId}>{children}</span>,
    createMuiTheme: jest.fn().mockImplementation(() =>
      createTheme({
        palette: {
          allShades: {
            white: '#ffffff',
            black: '#000000',
            brand: {
              50: '#e8eaf6',
              100: '#c5cae9',
              200: '#9fa8da',
              300: '#7986cb',
              400: '#5c6bc0',
              500: '#3f51b5',
              600: '#3949ab',
              700: '#303f9f',
              800: '#283593',
              900: '#1a237e',
            },
            blue: {
              50: '#e3f2fd',
              100: '#bbdefb',
              400: '#42a5f5',
              500: '#1890ff',
              600: '#1976d2',
              700: '#1565c0',
            },
            blueGray: {
              50: '#eceff1',
              100: '#cfd8dc',
              200: '#b0bec5',
              300: '#90a4ae',
              400: '#78909c',
              500: '#607d8b',
              600: '#546e7a',
              700: '#455a64',
            },
            gray: {
              50: '#fafafa',
              100: '#f5f5f5',
              200: '#eeeeee',
              300: '#d1d1d1',
              400: '#bdbdbd',
              500: '#9e9e9e',
              600: '#757575',
              700: '#616161',
              800: '#424242',
              900: '#212121',
            },
            green: { 50: '#e8f5e9', 500: '#4caf50', 700: '#388e3c' },
            red: { 50: '#ffebee', 500: '#f44336', 700: '#d32f2f' },
            orange: { 50: '#fff3e0', 500: '#ff9800', 700: '#f57c00' },
            success: {
              50: '#e8f5e9',
              100: '#c8e6c9',
              400: '#66bb6a',
              500: '#4caf50',
              600: '#43a047',
              700: '#388e3c',
              900: '#1b5e20',
            },
            error: {
              50: '#ffebee',
              100: '#ffcdd2',
              400: '#ef5350',
              500: '#f44336',
              600: '#e53935',
              700: '#d32f2f',
              900: '#b71c1c',
            },
            warning: {
              50: '#fff8e1',
              100: '#ffecb3',
              400: '#ffa726',
              500: '#ff9800',
              600: '#fb8c00',
              700: '#f57c00',
            },
            info: {
              50: '#e3f2fd',
              400: '#42a5f5',
              500: '#2196f3',
              600: '#1e88e5',
              700: '#1976d2',
            },
          },
        },
      })
    ),
  };
});

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    pathname: '/my-data',
  }));
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({
    entityTypeFQN: 'entityTypeFQN',
  }),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  Link: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => <a {...rest}>{children}</a>),
}));

const theme = createMuiTheme();

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <MemoryRouter>{children}</MemoryRouter>
  </ThemeProvider>
);

const mockProps = {
  pageTitle: 'tags',
};

const mockCategory = [
  {
    id: '93285c04-d8b6-4833-997e-56dc5f973427',
    name: 'PersonalData',
    description: 'description',
    version: 0.1,
    updatedAt: 1649665563400,
    updatedBy: 'admin',
    owners: [],
    href: 'http://localhost:8585/api/v1/tags/PersonalData',
    usageCount: 0,
    children: [
      {
        id: '8a218558-7b8f-446f-ace7-29b031c856b3',
        name: 'Personal',
        fullyQualifiedName: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        version: 0.1,
        updatedAt: 1649665563400,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/tags/PersonalData/Personal',
        usageCount: 0,
        deprecated: false,
        deleted: false,
        associatedTags: [],
      },
      {
        id: '4a2d7e47-9129-4cfe-91e8-e4f4df15f41d',
        name: 'SpecialCategory',
        fullyQualifiedName: 'PersonalData.SpecialCategory',
        description: 'description',
        version: 0.1,
        updatedAt: 1649665563400,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/tags/PersonalData/SpecialCategory',
        usageCount: 0,
        deprecated: false,
        deleted: false,
        associatedTags: [],
      },
    ],
    deleted: false,
  },
  {
    id: '3ee52f19-6d39-41ab-8398-36adbf66c168',
    name: 'PII',
    description: 'description',
    version: 0.1,
    updatedAt: 1649665563410,
    updatedBy: 'admin',
    provider: 'user',
    owners: [],
    href: 'http://localhost:8585/api/v1/tags/PII',
    usageCount: 0,
    children: [
      {
        id: '976af6dc-1cd1-481c-8d2f-2d38bbfe05fe',
        name: 'None',
        fullyQualifiedName: 'PII.None',
        description: 'Non PII',
        version: 0.1,
        updatedAt: 1649665563410,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/tags/PII/None',
        usageCount: 0,
        deprecated: false,
        deleted: false,
        associatedTags: [],
      },
      {
        id: '4840c344-fc15-4434-925d-779b32284a0d',
        name: 'NonSensitive',
        fullyQualifiedName: 'PII.NonSensitive',
        description: 'description',
        version: 0.1,
        updatedAt: 1649665563410,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/tags/PII/NonSensitive',
        usageCount: 0,
        deprecated: false,
        deleted: false,
        associatedTags: [],
      },
      {
        id: 'ec1f8f8d-0519-45fb-a8d3-a32b4067a8be',
        name: 'Sensitive',
        fullyQualifiedName: 'PII.Sensitive',
        description: 'description',
        version: 0.1,
        updatedAt: 1649665563410,
        updatedBy: 'admin',
        href: 'http://localhost:8585/api/v1/tags/PII/Sensitive',
        usageCount: 0,
        deprecated: false,
        deleted: false,
        associatedTags: [],
      },
    ],
    deleted: false,
  },
];

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
    }),
    permissions: {
      classification: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
      },
      tag: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
      },
    },
  }),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  },
}));

jest.mock('../../rest/tagAPI', () => ({
  createTag: jest.fn(),
  createClassification: jest.fn(),
  updateTag: jest.fn(),
  updateClassification: jest.fn(),
  deleteClassification: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_DELETE_CLASSIFICATION)),
  deleteTag: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_DELETE_TAG)),
  getAllClassifications: jest
    .fn()
    .mockImplementation(() => MOCK_ALL_CLASSIFICATIONS),

  getTags: jest.fn().mockImplementation(() => Promise.resolve(MOCK_TAGS)),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getClassifications: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_TAGS_CATEGORY })),
  getTaglist: jest.fn().mockReturnValue(['tag 1', 'tag 2']),
  getDeleteIcon: jest.fn().mockImplementation(() => <div>Icon</div>),
  getUsageCountLink: jest
    .fn()
    .mockImplementation(() => <a href="/">Usage Count</a>),
}));

jest.mock('../../components/common/ResizablePanels/ResizableLeftPanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      {firstPanel.children}
      {secondPanel.children}
    </div>
  ))
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => {
    const WrappedComponent = (props: Record<string, unknown>) => (
      <Component {...props} />
    );

    return WrappedComponent;
  }),
}));

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

jest.mock('../../components/Modals/EntityDeleteModal/EntityDeleteModal', () => {
  return jest.fn().mockImplementation(({ onCancel, onConfirm }) => (
    <div data-testid="confirmation-modal">
      <button data-testid="cancel-modal" onClick={onCancel}>
        Cancel
      </button>
      <button data-testid="confirm-modal" onClick={onConfirm}>
        Confirm
      </button>
    </div>
  ));
});

jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<p>DescriptionComponent</p>);
});

jest.mock('../../components/DataAssets/OwnerLabelV2/OwnerLabelV2', () => ({
  OwnerLabelV2: jest.fn().mockImplementation(() => <div>OwnerLabelV2</div>),
}));

jest.mock(
  '../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    useGenericContext: jest.fn().mockReturnValue({
      data: {
        id: '93285c04-d8b6-4833-997e-56dc5f973427',
        name: 'PersonalData',
        description: 'description',
        version: 0.1,
        updatedAt: 1649665563400,
        updatedBy: 'admin',
        owners: [],
        href: 'http://localhost:8585/api/v1/tags/PersonalData',
        usageCount: 0,
        children: [
          {
            id: '8a218558-7b8f-446f-ace7-29b031c856b3',
            name: 'Personal',
            fullyQualifiedName: 'PersonalData.Personal',
            description:
              'Data that can be used to directly or indirectly identify a person.',
            version: 0.1,
            updatedAt: 1649665563400,
            updatedBy: 'admin',
            href: 'http://localhost:8585/api/v1/tags/PersonalData/Personal',
            usageCount: 0,
            deprecated: false,
            deleted: false,
            associatedTags: [],
          },
          {
            id: '4a2d7e47-9129-4cfe-91e8-e4f4df15f41d',
            name: 'SpecialCategory',
            fullyQualifiedName: 'PersonalData.SpecialCategory',
            description: 'description',
            version: 0.1,
            updatedAt: 1649665563400,
            updatedBy: 'admin',
            href: 'http://localhost:8585/api/v1/tags/PersonalData/SpecialCategory',
            usageCount: 0,
            deprecated: false,
            deleted: false,
            associatedTags: [],
          },
        ],
        deleted: false,
      },
      onUpdate: jest.fn(),
      filterWidgets: jest.fn(),
    }),
    GenericProvider: jest.fn().mockImplementation(({ children }) => children),
    _esModule: true,
  })
);

jest.mock(
  '../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

jest.mock('../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

describe('Test TagsPage page', () => {
  it('Component should render', async () => {
    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });

    expect(getAllClassifications).toHaveBeenCalled();

    const tagsComponent = await screen.findByTestId('tags-container');
    const leftPanelContent = await screen.findByTestId('tags-left-panel');
    const header = await screen.findByTestId('header');
    const descriptionContainer = await screen.findByTestId(
      'description-container'
    );
    const table = await screen.findByTestId('table');
    const sidePanelCategories = await screen.findAllByTestId(
      'side-panel-classification'
    );

    expect(tagsComponent).toBeInTheDocument();
    expect(leftPanelContent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(sidePanelCategories).toHaveLength(3);
  });

  it('Classification LeftPanel count should render properly', async () => {
    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const leftPanelContent = screen.getByTestId('tags-left-panel');
    const sidePanelCategories = await screen.findAllByTestId(
      'side-panel-classification'
    );

    expect(leftPanelContent).toBeInTheDocument();
    expect(sidePanelCategories).toHaveLength(3);

    const getAllCounts = await screen.findAllByTestId('filter-count');

    expect(getAllCounts).toHaveLength(3);

    expect(getByText(getAllCounts[0], '2')).toBeInTheDocument();
    expect(getByText(getAllCounts[1], '3')).toBeInTheDocument();
    expect(getByText(getAllCounts[2], '5')).toBeInTheDocument();
  });

  it('OnClick of add new tag, Form should display in drawer', async () => {
    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const addNewTag = screen.getByTestId('add-new-tag-button');

    expect(addNewTag).toBeInTheDocument();

    fireEvent.click(addNewTag);

    // Wait for the drawer to open and form to render (setTimeout is used in the code)
    await waitFor(() => {
      expect(screen.getByTestId('name')).toBeInTheDocument();
    });
  });

  it('OnClick of delete tag, confirmation modal should display', async () => {
    const { container } = render(<TagsPage {...mockProps} />, {
      wrapper: Wrapper,
    });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));
    const deleteBtn = await findAllByTestId(container, 'delete-tag');

    expect(deleteBtn[0]).toBeInTheDocument();

    fireEvent.click(deleteBtn[0]);
    await waitFor(async () => {
      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();
    });

    fireEvent.click(deleteBtn[0]);

    await waitFor(async () => {
      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();
    });

    fireEvent.click(await findByTestId(container, 'confirm-modal'));
  });

  it('OnClick of add new category, Form should display in drawer', async () => {
    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });

    const loader = screen.queryByTestId('loader');
    if (loader) {
      await waitForElementToBeRemoved(loader);
    }

    const addNewCategory = await screen.findByTestId('add-classification');

    expect(addNewCategory).toBeInTheDocument();

    fireEvent.click(addNewCategory);

    // Wait for the drawer to open and form to render (setTimeout is used in the code)
    await waitFor(() => {
      expect(screen.getByTestId('name')).toBeInTheDocument();
    });
  });

  it('Description should be in document', async () => {
    const { container } = render(<TagsPage {...mockProps} />, {
      wrapper: Wrapper,
    });

    const loader = screen.queryByTestId('loader');
    if (loader) {
      await waitForElementToBeRemoved(loader);
    }

    const descriptionContainer = await screen.findByTestId(
      'description-container'
    );
    const description = await findByText(container, /DescriptionComponent/i);

    expect(descriptionContainer).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('Table with respective header should be render', async () => {
    const { container } = render(<TagsPage {...mockProps} />, {
      wrapper: Wrapper,
    });

    const loader = screen.queryByTestId('loader');
    if (loader) {
      await waitForElementToBeRemoved(loader);
    }

    const table = await findByTestId(container, 'table');
    const name = await findByText(container, 'label.tag');
    const actions = await findByText(container, 'label.action-plural');

    expect(table).toBeInTheDocument();
    expect(actions).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(descriptionTableObject).toHaveBeenCalledWith({ width: 300 });
  });

  it('Should render error placeholder if categories api fails', async () => {
    (getAllClassifications as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(
        Object.assign(new Error('Error!'), {
          response: { data: { message: 'Error!' } },
        })
      )
    );
    const { container } = render(<TagsPage {...mockProps} />, {
      wrapper: Wrapper,
    });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const errorPlaceholder = await findByTestId(
      container,
      'no-data-placeholder'
    );

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('System tag category should not be renamed', async () => {
    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const tagsComponent = screen.getByTestId('tags-container');
    const header = screen.getByTestId('header');
    const editIcon = screen.queryByTestId('name-edit-icon');

    expect(tagsComponent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(editIcon).not.toBeInTheDocument();
  });

  // api is not working for this feature
  it.skip('User classification should be renamed', async () => {
    (getClassifications as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [mockCategory[1]] })
    );
    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const tagsComponent = screen.getByTestId('tags-container');
    const header = screen.getByTestId('header');
    const leftPanelContent = screen.getByTestId('tags-left-panel');
    const editIcon = screen.getByTestId('name-edit-icon');
    const tagCategoryName = screen.getByTestId('classification-name');

    expect(tagsComponent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(leftPanelContent).toBeInTheDocument();
    expect(editIcon).toBeInTheDocument();
    expect(tagCategoryName).toBeInTheDocument();

    fireEvent.click(editIcon);

    const tagCategoryHeading = screen.getByTestId(
      'current-classification-name'
    );
    const cancelAssociatedTag = screen.getByTestId('cancelAssociatedTag');
    const saveAssociatedTag = screen.getByTestId('saveAssociatedTag');

    expect(tagCategoryHeading).toBeInTheDocument();
    expect(cancelAssociatedTag).toBeInTheDocument();
    expect(saveAssociatedTag).toBeInTheDocument();

    fireEvent.change(tagCategoryHeading, {
      target: {
        value: 'newPII',
      },
    });

    expect(tagCategoryHeading).toHaveValue('newPII');
  });

  it('User tag should be load', async () => {
    const { container } = render(<TagsPage {...mockProps} />, {
      wrapper: Wrapper,
    });
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const tagsComponent = screen.getByTestId('tags-container');
    const classification = await screen.findAllByText('PersonalData');

    fireEvent.click(classification[0]);

    const tagEditIcon = await findAllByTestId(container, 'edit-button');

    expect(tagEditIcon[0]).toBeInTheDocument();

    fireEvent.click(tagEditIcon[0]);

    const tagName = screen.getByTestId('test_tag');

    expect(tagName).toBeInTheDocument();
    expect(tagsComponent).toBeInTheDocument();
  });

  it("Should not render add classification button if doesn't have create permission", async () => {
    (checkPermission as jest.Mock).mockReturnValueOnce(false);

    render(<TagsPage {...mockProps} />, { wrapper: Wrapper });

    expect(screen.queryByTestId('add-classification')).not.toBeInTheDocument();
  });

  describe('Render Sad Paths', () => {
    it.skip('Show error message on failing of deleteTag API', async () => {
      (deleteTag as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(
          Object.assign(new Error('error!'), {
            response: { data: 'error!' },
          })
        )
      );
      render(<TagsPage {...mockProps} />, { wrapper: Wrapper });
      await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

      const deleteBtn = await screen.findAllByTestId('delete-tag');

      expect(deleteBtn[0]).toBeInTheDocument();

      fireEvent.click(deleteBtn[0]);

      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('confirm-modal'));

      expect(screen.queryByTitle('confirmation-modal')).not.toBeInTheDocument();
    });

    it('Show error message on resolve of deleteTag API, without response', async () => {
      (deleteTag as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ data: '' })
      );
      const { container } = render(<TagsPage {...mockProps} />, {
        wrapper: Wrapper,
      });

      const deleteBtn = await findAllByTestId(container, 'delete-tag');

      expect(deleteBtn[0]).toBeInTheDocument();

      fireEvent.click(deleteBtn[0]);

      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();

      fireEvent.click(await findByTestId(container, 'confirm-modal'));

      expect(
        queryByTitle(container, 'confirmation-modal')
      ).not.toBeInTheDocument();
    });
  });

  it('should pass classification name as pageTitle to withPageLayout', async () => {
    (getAllClassifications as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ALL_CLASSIFICATIONS)
    );

    render(<TagsPage {...mockProps} />, {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(ResizableLeftPanels).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'PersonalData',
        }),
        expect.anything()
      )
    );
  });
});
