/*
 *  Copyright 2021 Collate
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

import {
  act,
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  queryByTestId,
  queryByTitle,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import TagsPage from '.';
import {
  deleteTag,
  deleteTagCategory,
  updateTagCategory,
} from '../../axiosAPIs/tagAPI';
import { getTagCategories } from '../../utils/TagsUtils';

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

const mockTagsCategory = [
  {
    categoryType: 'Classification',
    id: 'test',
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
    ],
    description: 'description',
    href: 'link',
    name: 'PersonalData',
    usageCount: 3,
  },
  {
    categoryType: 'Classification',
    id: 'test2',
    children: [],
    description: 'description',
    href: 'link',
    name: 'PII',
    usageCount: 2,
  },
];

const mockCategory = [
  {
    id: '93285c04-d8b6-4833-997e-56dc5f973427',
    name: 'PersonalData',
    description: 'description',
    version: 0.1,
    updatedAt: 1649665563400,
    updatedBy: 'admin',
    categoryType: 'Classification',
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
    categoryType: 'Classification',
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

jest.mock('../../axiosAPIs/tagAPI', () => ({
  createTag: jest.fn(),
  createTagCategory: jest.fn(),
  updateTag: jest.fn(),
  updateTagCategory: jest.fn(),
  deleteTagCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockCategory })),
  deleteTag: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: mockCategory[0].children[0] })
    ),
  getCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockCategory })),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getTagCategories: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTagsCategory })),
  getTaglist: jest.fn().mockReturnValue(['tag 1', 'tag 2']),
  getTagOptionsFromFQN: jest.fn().mockReturnValue([]),
}));

jest.mock(
  '../../components/containers/PageLayout',
  () =>
    ({ children, leftPanel }: { children: ReactNode; leftPanel: ReactNode }) =>
      (
        <div data-testid="PageLayout">
          <div data-testid="left-panel-content">{leftPanel}</div>
          {children}
        </div>
      )
);

jest.mock(
  '../../components/containers/PageContainerV1',
  () =>
    ({ children }: { children: ReactNode }) =>
      <div data-testid="PageContainerV1">{children}</div>
);

jest.mock('../../components/common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest.fn(),
  })
);

jest.mock(
  '../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

jest.mock('../../components/Modals/ConfirmationModal/ConfirmationModal', () => {
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

jest.mock('../../components/Modals/FormModal', () => {
  return jest.fn().mockReturnValue(<p data-testid="form-modal">FormModal</p>);
});

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>DescriptionComponent</p>);
});

jest.mock('../../components/common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ));
});

describe('Test TagsPage page', () => {
  it('Component should render', async () => {
    const { container } = render(<TagsPage />);
    const tagsComponent = await findByTestId(container, 'tags-container');
    const pageContainerComponent = await findByTestId(
      container,
      'PageContainerV1'
    );
    const leftPanelContent = await findByTestId(
      container,
      'left-panel-content'
    );
    const header = await findByTestId(container, 'header');
    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const table = await findByTestId(container, 'table');
    const sidePanelCategories = await findAllByTestId(
      container,
      'side-panel-category'
    );

    expect(tagsComponent).toBeInTheDocument();
    expect(pageContainerComponent).toBeInTheDocument();
    expect(leftPanelContent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(sidePanelCategories.length).toBe(2);
  });

  it('OnClick of add new tag, AddUsersModal should display', async () => {
    const { container } = render(<TagsPage />);
    const addNewTag = await findByTestId(container, 'add-new-tag-button');

    expect(addNewTag).toBeInTheDocument();

    fireEvent.click(
      addNewTag,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(await findByTestId(container, 'form-modal')).toBeInTheDocument();
  });

  it('OnClick of delete category, confirmation modal should display', async () => {
    await act(async () => {
      const { container } = render(<TagsPage />);
      const deleteBtn = await findByTestId(
        container,
        'delete-tag-category-button'
      );

      expect(deleteBtn).toBeInTheDocument();

      fireEvent.click(deleteBtn);

      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();

      // on click of cancel for confirmation modal, modal will removed
      fireEvent.click(await findByTestId(container, 'cancel-modal'));

      expect(
        queryByTestId(container, 'confirmation-modal')
      ).not.toBeInTheDocument();

      fireEvent.click(deleteBtn);

      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();

      fireEvent.click(await findByTestId(container, 'confirm-modal'));
    });
  });

  it('OnClick of delete tag, confirmation modal should display', async () => {
    await act(async () => {
      const { container } = render(<TagsPage />);
      const deleteBtn = await findByTestId(container, 'delete-tag');

      expect(deleteBtn).toBeInTheDocument();

      fireEvent.click(deleteBtn);

      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();

      // on click of cancel for confirmation modal, modal will removed
      fireEvent.click(await findByTestId(container, 'cancel-modal'));

      expect(
        queryByTestId(container, 'confirmation-modal')
      ).not.toBeInTheDocument();

      fireEvent.click(deleteBtn);

      expect(
        await findByTestId(container, 'confirmation-modal')
      ).toBeInTheDocument();

      fireEvent.click(await findByTestId(container, 'confirm-modal'));
    });
  });

  it('OnClick of add new category, AddUsersModal should display', async () => {
    const { container } = render(<TagsPage />);
    const addNewCategory = await findByTestId(container, 'add-category');

    expect(addNewCategory).toBeInTheDocument();

    fireEvent.click(
      addNewCategory,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(await findByTestId(container, 'form-modal')).toBeInTheDocument();
  });

  it('Description should be in document', async () => {
    const { container } = render(<TagsPage />);

    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const description = await findByText(container, /DescriptionComponent/i);

    expect(descriptionContainer).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('Table with respective header should be render', async () => {
    const { container } = render(<TagsPage />);
    const table = await findByTestId(container, 'table');
    const name = await findByTestId(container, 'heading-name');
    const description = await findByTestId(container, 'heading-description');
    const actions = await findByTestId(container, 'heading-actions');
    const associatedTags = await findByTestId(
      container,
      'heading-associated-tags'
    );
    const tableBody = await findByTestId(container, 'table-body');

    expect(table).toBeInTheDocument();
    expect(actions).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(associatedTags).toBeInTheDocument();
    expect(tableBody).toBeInTheDocument();
  });

  it('Should render error placeholder if categories api fails', async () => {
    (getTagCategories as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: { message: 'Error!' },
        },
      })
    );
    const { container } = render(<TagsPage />);

    const errorPlaceholder = await findByTestId(container, 'error');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Should render error placeholder if update categories api fails', async () => {
    (updateTagCategory as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: { message: 'Error!' },
        },
      })
    );
    const { container } = render(<TagsPage />);
    const tagsComponent = await findByTestId(container, 'tags-container');
    const pageContainerComponent = await findByTestId(
      container,
      'PageContainerV1'
    );
    const leftPanelContent = await findByTestId(
      container,
      'left-panel-content'
    );
    const header = await findByTestId(container, 'header');
    const descriptionContainer = await findByTestId(
      container,
      'description-container'
    );
    const table = await findByTestId(container, 'table');
    const sidePanelCategories = await findAllByTestId(
      container,
      'side-panel-category'
    );

    expect(tagsComponent).toBeInTheDocument();
    expect(pageContainerComponent).toBeInTheDocument();
    expect(leftPanelContent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(descriptionContainer).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(sidePanelCategories.length).toBe(2);
  });

  describe('Render Sad Paths', () => {
    it('Show error message on failing of deleteTagCategory API', async () => {
      (deleteTagCategory as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: 'error!' } })
      );
      await act(async () => {
        const { container } = render(<TagsPage />);
        const deleteBtn = await findByTestId(
          container,
          'delete-tag-category-button'
        );

        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(deleteBtn);

        expect(
          await findByTestId(container, 'confirmation-modal')
        ).toBeInTheDocument();

        fireEvent.click(await findByTestId(container, 'confirm-modal'));

        expect(
          queryByTitle(container, 'confirmation-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('Show error message on resolve of deleteTagCategory API, without response', async () => {
      (deleteTagCategory as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      await act(async () => {
        const { container } = render(<TagsPage />);
        const deleteBtn = await findByTestId(
          container,
          'delete-tag-category-button'
        );

        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(deleteBtn);

        expect(
          await findByTestId(container, 'confirmation-modal')
        ).toBeInTheDocument();

        fireEvent.click(await findByTestId(container, 'confirm-modal'));

        expect(
          queryByTitle(container, 'confirmation-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('Show error message on failing of deleteTag API', async () => {
      (deleteTag as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: 'error!' } })
      );
      await act(async () => {
        const { container } = render(<TagsPage />);
        const deleteBtn = await findByTestId(container, 'delete-tag');

        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(deleteBtn);

        expect(
          await findByTestId(container, 'confirmation-modal')
        ).toBeInTheDocument();

        fireEvent.click(await findByTestId(container, 'confirm-modal'));

        expect(
          queryByTitle(container, 'confirmation-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('Show error message on resolve of deleteTag API, without response', async () => {
      (deleteTag as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      await act(async () => {
        const { container } = render(<TagsPage />);
        const deleteBtn = await findByTestId(container, 'delete-tag');

        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(deleteBtn);

        expect(
          await findByTestId(container, 'confirmation-modal')
        ).toBeInTheDocument();

        fireEvent.click(await findByTestId(container, 'confirm-modal'));

        expect(
          queryByTitle(container, 'confirmation-modal')
        ).not.toBeInTheDocument();
      });
    });
  });
});
