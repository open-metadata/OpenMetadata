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
import { BrowserRouter } from 'react-router-dom';
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

describe('ContainerChildren', () => {
  it('Should render table with correct columns', () => {
    render(
      <BrowserRouter>
        <ContainerChildren childrenList={mockChildrenList} />
      </BrowserRouter>
    );

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
  });

  it('Should render container names as links', () => {
    render(
      <BrowserRouter>
        <ContainerChildren childrenList={mockChildrenList} />
      </BrowserRouter>
    );

    const containerNameLinks = screen.getAllByTestId('container-name');

    expect(containerNameLinks).toHaveLength(2);

    containerNameLinks.forEach((link, index) => {
      expect(link).toHaveAttribute(
        'href',
        `/container/${mockChildrenList[index].fullyQualifiedName}`
      );
      expect(link).toHaveTextContent(mockChildrenList[index].name);
    });
  });

  it('Should render container descriptions as rich text', () => {
    render(
      <BrowserRouter>
        <ContainerChildren childrenList={mockChildrenList} />
      </BrowserRouter>
    );

    const richTextPreviewers = screen.getAllByTestId('viewer-container');

    expect(richTextPreviewers).toHaveLength(2);

    richTextPreviewers.forEach((previewer, index) => {
      expect(previewer).toHaveTextContent(mockChildrenList[index].description);
    });
  });
});
