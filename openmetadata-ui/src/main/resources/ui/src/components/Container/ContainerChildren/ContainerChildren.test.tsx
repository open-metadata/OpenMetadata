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
import { MemoryRouter } from 'react-router-dom';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getContainerChildrenByName } from '../../../rest/storageAPI';
import ContainerChildren from './ContainerChildren';

jest.mock('../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(({ pagingHandler, onShowSizeChange }) => (
    <div>
      <p>NextPreviousComponent</p>
      <button onClick={pagingHandler}>childrenPageChangeButton</button>
      <button onClick={onShowSizeChange}>pageSizeChangeButton</button>
    </div>
  ));
});
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockImplementation(({ markdown }) => <div>{markdown}</div>)
);

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
jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockImplementation(() => ({
    pageSize: 15,
    paging: {
      total: 2,
    },
  })),
}));

describe('ContainerChildren', () => {
  it('Should call fetch container function on load', () => {
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(getContainerChildrenByName).toHaveBeenCalledWith('', {
      limit: 15,
      offset: 0,
    });
  });

  it('Should render table with correct columns', () => {
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
  });

  it('Should not render pagination component when not visible', () => {
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(screen.queryByText('NextPreviousComponent')).not.toBeInTheDocument();
  });

  it('Should render container names as links', async () => {
    (getContainerChildrenByName as jest.Mock).mockResolvedValue({
      data: mockChildrenList,
      paging: {
        total: 2,
      },
    });
    render(<ContainerChildren />, { wrapper: MemoryRouter });

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

  it('Should render pagination component when showPagination props is true', () => {
    (usePaging as jest.Mock).mockImplementation(() => ({
      showPagination: true,
    }));
    render(<ContainerChildren />, { wrapper: MemoryRouter });

    expect(screen.getByText('NextPreviousComponent')).toBeInTheDocument();
  });
});
