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
  findAllByTestId,
  findByTestId,
  fireEvent,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import TagsPage from '.';

const mockTagsCategory = [
  {
    categoryType: 'Classification',
    children: [],
    description: 'description',
    href: 'link',
    name: 'PersonalData',
    usageCount: 3,
  },
  {
    categoryType: 'Classification',
    children: [],
    description: 'description',
    href: 'link',
    name: 'PII',
    usageCount: 2,
  },
];

const mockCategory = [
  {
    categoryType: 'Classification',
    description: 'description',
    children: [
      {
        associatedTags: [],
        deprecated: false,
        description: 'Non PII',
        fullyQualifiedName: 'PII.None',
        href: 'http://localhost:8585/api/v1/tags/PII/None',
        name: 'None',
        usageCount: 0,
      },
    ],
    href: 'link',
    name: 'PII',
    usageCount: 0,
  },
];

jest.mock('../../axiosAPIs/tagAPI', () => ({
  createTag: jest.fn(),
  createTagCategory: jest.fn(),
  updateTag: jest.fn(),
  updateTagCategory: jest.fn(),
  getCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockCategory })),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getTagCategories: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTagsCategory })),
  getTaglist: jest.fn().mockReturnValue(['tag 1', 'tag 2']),
}));

jest.mock(
  '../../components/containers/PageContainer',
  () =>
    ({
      children,
      leftPanelContent,
    }: {
      children: ReactNode;
      leftPanelContent: ReactNode;
    }) =>
      (
        <div data-testid="PageContainer">
          <div data-testid="left-panel-content">{leftPanelContent}</div>
          {children}
        </div>
      )
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

jest.mock('../../components/Modals/FormModal', () => {
  return jest.fn().mockReturnValue(<p data-testid="form-modal">FormModal</p>);
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
      'PageContainer'
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
    const addDescription = await findByTestId(container, 'add-description');

    expect(descriptionContainer).toBeInTheDocument();
    expect(addDescription).toBeInTheDocument();
  });

  it('Table with respective header should be render', async () => {
    const { container } = render(<TagsPage />);
    const table = await findByTestId(container, 'table');
    const name = await findByTestId(container, 'heading-name');
    const description = await findByTestId(container, 'heading-description');
    const associatedTags = await findByTestId(
      container,
      'heading-associated-tags'
    );
    const tableBody = await findByTestId(container, 'table-body');

    expect(table).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(associatedTags).toBeInTheDocument();
    expect(tableBody).toBeInTheDocument();
  });
});
