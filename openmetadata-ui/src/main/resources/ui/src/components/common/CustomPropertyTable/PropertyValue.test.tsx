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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PropertyValue } from './PropertyValue';

jest.mock('../../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="RichTextPreviewer">RichTextPreviewer</div>
    );
});

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<div data-testid="EditorModal">EditorModal</div>),
  })
);

jest.mock('./PropertyInput', () => ({
  PropertyInput: jest
    .fn()
    .mockReturnValue(<div data-testid="PropertyInput">PropertyInput</div>),
}));

const mockUpdate = jest.fn();

const mockData = {
  extension: { yNumber: 87 },
  propertyName: 'yNumber',
  propertyType: {
    id: '73f1e4a4-4c62-4399-9d6d-4a3906851483',
    type: 'type',
    name: 'integer',
    fullyQualifiedName: 'integer',
    description: '"An integer type."',
    displayName: 'integer',
    href: 'http://localhost:8585/api/v1/metadata/types/73f1e4a4-4c62-4399-9d6d-4a3906851483',
  },
  onExtensionUpdate: mockUpdate,
  hasEditPermissions: true,
};

describe('Test PropertyValue Component', () => {
  it('Should render value component', async () => {
    render(<PropertyValue {...mockData} />);

    const valueElement = await screen.findByTestId('value');
    const iconElement = await screen.findByTestId('edit-icon');

    expect(valueElement).toBeInTheDocument();
    expect(iconElement).toBeInTheDocument();

    fireEvent.click(iconElement);

    expect(await screen.findByTestId('PropertyInput')).toBeInTheDocument();
  });

  it('Should not render edit component if user has no edit permissions', async () => {
    render(<PropertyValue {...mockData} hasEditPermissions={false} />);

    const iconElement = await screen.queryByTestId('edit-icon');

    expect(iconElement).not.toBeInTheDocument();
  });

  it('Should render richtext previewer component for markdown type', async () => {
    const extension = { yNumber: 'markdown value' };
    const propertyType = { ...mockData.propertyType, name: 'markdown' };
    render(
      <PropertyValue
        {...mockData}
        extension={extension}
        propertyType={propertyType}
      />
    );

    const valueElement = await screen.findByTestId('RichTextPreviewer');
    const iconElement = await screen.findByTestId('edit-icon');

    expect(valueElement).toBeInTheDocument();
    expect(iconElement).toBeInTheDocument();

    fireEvent.click(iconElement);

    expect(await screen.findByTestId('EditorModal')).toBeInTheDocument();
  });
});
