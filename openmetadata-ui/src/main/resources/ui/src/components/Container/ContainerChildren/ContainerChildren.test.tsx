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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { pagingObject } from '../../../constants/constants';
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

const mockFetchChildren = jest.fn();
const mockHandleChildrenPageChange = jest.fn();
const mockHandlePageSizeChange = jest.fn();

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

const mockDataProps = {
  childrenList: mockChildrenList,
  fetchChildren: mockFetchChildren,
  pagingHookData: {
    paging: pagingObject,
    pageSize: 15,
    currentPage: 1,
    showPagination: true,
    handleChildrenPageChange: mockHandleChildrenPageChange,
    handlePageSizeChange: mockHandlePageSizeChange,
  },
};

describe('ContainerChildren', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('Should call fetch container function on load', () => {
    render(
      <BrowserRouter>
        <ContainerChildren {...mockDataProps} />
      </BrowserRouter>
    );

    expect(mockFetchChildren).toHaveBeenCalled();
  });

  it('Should render table with correct columns', () => {
    render(
      <BrowserRouter>
        <ContainerChildren {...mockDataProps} />
      </BrowserRouter>
    );

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
  });

  it('Should not render pagination component when not visible', () => {
    render(
      <BrowserRouter>
        <ContainerChildren
          {...mockDataProps}
          pagingHookData={{
            ...mockDataProps.pagingHookData,
            showPagination: false,
          }}
        />
      </BrowserRouter>
    );

    expect(screen.queryByText('NextPreviousComponent')).not.toBeInTheDocument();
  });

  it('Should render container names as links', () => {
    render(
      <BrowserRouter>
        <ContainerChildren {...mockDataProps} />
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
        <ContainerChildren {...mockDataProps} />
      </BrowserRouter>
    );

    // Fast-forward until all timers have been executed
    jest.runAllTimers();

    const richTextPreviewers = screen.getAllByTestId('viewer-container');

    expect(richTextPreviewers).toHaveLength(2);

    richTextPreviewers.forEach((previewer, index) => {
      expect(previewer).toHaveTextContent(mockChildrenList[index].description);
    });
  });

  it('Should render pagination component when showPagination props is true', () => {
    render(
      <BrowserRouter>
        <ContainerChildren
          {...mockDataProps}
          pagingHookData={{
            ...mockDataProps.pagingHookData,
            showPagination: true,
          }}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('NextPreviousComponent')).toBeInTheDocument();
  });

  it('Should trigger handleChildrenPageChange hook prop on button click', () => {
    render(
      <BrowserRouter>
        <ContainerChildren {...mockDataProps} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('childrenPageChangeButton'));

    expect(mockHandleChildrenPageChange).toHaveBeenCalled();
  });

  it('Should trigger handlePageSizeChange hook prop on button click', () => {
    render(
      <BrowserRouter>
        <ContainerChildren {...mockDataProps} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('pageSizeChangeButton'));

    expect(mockHandlePageSizeChange).toHaveBeenCalled();
  });
});
