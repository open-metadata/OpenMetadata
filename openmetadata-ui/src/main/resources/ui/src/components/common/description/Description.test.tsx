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

import { findByTestId, queryByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Description from './Description';

const mockEntityFieldThreads = [
  {
    entityLink:
      '<#E/table/bigquery_gcp.shopify.raw_product_catalog/description>',
    count: 1,
    entityField: 'description',
  },
];

const mockDescriptionProp = {
  description: 'description',
  isEdit: false,
  isReadOnly: false,
  blurWithBodyBG: false,
  removeBlur: false,
  entityName: 'entity1',
  entityFieldThreads: [],
  entityType: 'xyz',
  entityFqn: 'x.y.z',
  onCancel: jest.fn(),
  onDescriptionUpdate: jest.fn(),
  onThreadLinkSelect: jest.fn(),
  onEntityFieldSelect: jest.fn(),
};

jest.mock('../../../utils/CommonUtils', () => ({
  getHtmlForNonAdminAction: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(
        <p data-testid="editor-modal">ModalWithMarkdownEditor</p>
      ),
  })
);
jest.mock('../rich-text-editor/RichTextEditorPreviewer', () => {
  return jest
    .fn()
    .mockReturnValue(
      <p data-testid="rich-text-previewer">RichTextPreviewer</p>
    );
});

jest.mock('../non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="edit-description">NonAdminAction</p>);
});

describe('Test Description Component', () => {
  it('Check if it has all child elements', async () => {
    const { container } = render(<Description {...mockDescriptionProp} />, {
      wrapper: MemoryRouter,
    });

    const descriptionContainer = await findByTestId(container, 'description');
    const editDescriptionButton = await findByTestId(
      container,
      'edit-description'
    );

    expect(descriptionContainer).toBeInTheDocument();
    expect(editDescriptionButton).toBeInTheDocument();
  });

  it('Check if it has isReadOnly as true', async () => {
    const { container } = render(
      <Description {...mockDescriptionProp} isReadOnly />,
      {
        wrapper: MemoryRouter,
      }
    );

    const descriptionContainer = await findByTestId(container, 'description');
    const editDescriptionButton = queryByTestId(container, 'edit-description');

    expect(descriptionContainer).toBeInTheDocument();
    expect(editDescriptionButton).not.toBeInTheDocument();
  });

  it('Check if it has isEdit as true', async () => {
    const { container } = render(
      <Description {...mockDescriptionProp} isEdit />,
      {
        wrapper: MemoryRouter,
      }
    );

    const descriptionContainer = await findByTestId(container, 'description');
    const editorModal = await findByTestId(container, 'editor-modal');

    expect(descriptionContainer).toBeInTheDocument();
    expect(editorModal).toBeInTheDocument();
  });

  it('Check if it has isEdit as false', async () => {
    const { container } = render(
      <Description {...mockDescriptionProp} isEdit={false} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const descriptionContainer = await findByTestId(container, 'description');
    const editorModal = queryByTestId(container, 'editor-modal');

    expect(descriptionContainer).toBeInTheDocument();
    expect(editorModal).not.toBeInTheDocument();
  });

  it('Check if it has entityFieldThreads', async () => {
    const { container } = render(
      <Description
        {...mockDescriptionProp}
        entityFieldThreads={mockEntityFieldThreads}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const descriptionContainer = await findByTestId(container, 'description');
    const descriptionThread = await findByTestId(
      container,
      'description-thread'
    );
    const descriptionThreadCount = await findByTestId(
      descriptionThread,
      'description-thread-count'
    );

    expect(descriptionContainer).toBeInTheDocument();

    expect(descriptionThread).toBeInTheDocument();
    expect(descriptionThreadCount).toBeInTheDocument();
    // check for thread count
    expect(descriptionThreadCount).toHaveTextContent(
      String(mockEntityFieldThreads[0].count)
    );
  });

  it('Check if it has entityFieldThreads as empty list', async () => {
    const { container } = render(
      <Description {...mockDescriptionProp} entityFieldThreads={[]} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const descriptionContainer = await findByTestId(container, 'description');
    const descriptionThread = queryByTestId(container, 'description-thread');
    const startDescriptionThread = await findByTestId(
      container,
      'start-description-thread'
    );

    expect(descriptionContainer).toBeInTheDocument();
    expect(descriptionThread).not.toBeInTheDocument();
    // should render startDescription thread button, as description thread is empty value
    expect(startDescriptionThread).toBeInTheDocument();
  });

  it('Check if it has entityFieldThreads as empty list, description as empty string', async () => {
    const { container } = render(
      <Description
        {...mockDescriptionProp}
        description=""
        entityFieldThreads={[]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const descriptionContainer = await findByTestId(container, 'description');
    const descriptionThread = queryByTestId(container, 'description-thread');
    const startDescriptionThread = queryByTestId(
      container,
      'start-description-thread'
    );

    const requestDescription = await findByTestId(
      container,
      'request-description'
    );

    expect(descriptionContainer).toBeInTheDocument();
    expect(descriptionThread).not.toBeInTheDocument();
    expect(startDescriptionThread).not.toBeInTheDocument();

    // should render requestDescription, as description thread and description are empty value
    expect(requestDescription).toBeInTheDocument();
  });
});
