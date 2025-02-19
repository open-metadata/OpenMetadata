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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TabSpecificField } from '../../../enums/entity.enum';
import { getContainerByName } from '../../../rest/storageAPI';
import ContainerChildren from './ContainerChildren';

const mockChildrenList = [
  {
    id: '1',
    name: 'Container 1',
    fullyQualifiedName: 'namespace.Container1',
    description: 'Description of Container 1',
    type: 'container',
  },
  {
    id: '2',
    name: 'Container 2',
    fullyQualifiedName: 'namespace.Container2',
    description: 'Description of Container 2',
    type: 'container',
  },
];

jest.mock('../../Customization/GenericTab/GenericTab', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: { children: mockChildrenList },
  })),
}));

jest.mock('../../../rest/storageAPI');

describe('ContainerChildren', () => {
  it('Should call fetch container function on load', () => {
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(getContainerByName).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        fields: TabSpecificField.CHILDREN,
      })
    );
  });

  it('Should render table with correct columns', () => {
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
  });

  it('Should render container names as links', async () => {
    (getContainerByName as jest.Mock).mockResolvedValue({
      children: mockChildrenList,
    });
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(getContainerByName).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        fields: TabSpecificField.CHILDREN,
      })
    );

    const containerNameLinks = await screen.findAllByTestId('container-name');

    expect(containerNameLinks).toHaveLength(2);

    containerNameLinks.forEach((link, index) => {
      expect(link).toHaveAttribute(
        'href',
        `/container/${mockChildrenList[index].fullyQualifiedName}`
      );
      expect(link).toHaveTextContent(mockChildrenList[index].name);
    });
  });

  it('Should render container descriptions as rich text', async () => {
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    const richTextPreviewers = await screen.findAllByTestId('viewer-container');

    expect(richTextPreviewers).toHaveLength(2);

    richTextPreviewers.forEach((previewer, index) => {
      expect(previewer).toHaveTextContent(mockChildrenList[index].description);
    });
  });
});
