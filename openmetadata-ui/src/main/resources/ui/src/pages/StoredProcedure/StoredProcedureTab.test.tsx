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
import StoredProcedureTab from './StoredProcedureTab';

const mockPagingHandler = jest.fn();
const mockShowDeletedHandler = jest.fn();
const mockFetchHandler = jest.fn();

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockImplementation(() => <p>testErrorPlaceHolder</p>);
  }
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(({ pagingHandler }) => (
    <p data-testid="next-previous" onClick={pagingHandler}>
      testNextPrevious
    </p>
  ));
});

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewer',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <p>testRichTextEditorPreviewer</p>);
  }
);

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>testLoader</p>);
});

// mock library imports
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="#">{children}</a>),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation(() => 'displayName'),
}));

jest.mock('../../utils/StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
}));

jest.mock('../../utils/TableUtils', () => ({
  getEntityLink: jest.fn().mockImplementation((link) => link),
}));

describe('StoredProcedureTab component', () => {
  it('StoredProcedureTab should fetch details', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();
  });

  it('StoredProcedureTab should render components', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();
    expect(screen.getByTestId('stored-procedure-table')).toBeInTheDocument();
    expect(
      screen.getByTestId('show-deleted-stored-procedure')
    ).toBeInTheDocument();
    expect(screen.queryByText('testNextPrevious')).not.toBeInTheDocument();
  });

  it('StoredProcedureTab should show loader till api is not resolved', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();

    expect(screen.queryByText('testLoader')).toBeInTheDocument();
  });

  it('StoredProcedureTab should show empty placeholder within table when data is empty', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();

    expect(screen.queryByText('testErrorPlaceHolder')).toBeInTheDocument();
  });

  it('StoredProcedureTab should show table along with data', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();

    const container = screen.getByTestId('stored-procedure-table');

    expect(screen.getAllByText('testRichTextEditorPreviewer')).toHaveLength(2);

    screen.debug(container);
  });

  it('show deleted switch handler show properly', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();

    const showDeletedHandler = screen.getByTestId(
      'show-deleted-stored-procedure'
    );

    expect(showDeletedHandler).toBeInTheDocument();

    fireEvent.click(showDeletedHandler);

    expect(mockShowDeletedHandler).toHaveBeenCalled();
  });

  it('show render next_previous component', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();

    expect(screen.queryByText('testNextPrevious')).toBeInTheDocument();
  });

  it('next_previous handler should work properly', () => {
    render(<StoredProcedureTab />);

    expect(mockFetchHandler).toHaveBeenCalled();

    const nextComponent = screen.getByTestId('next-previous');

    expect(nextComponent).toBeInTheDocument();

    fireEvent.click(nextComponent);

    expect(mockPagingHandler).toHaveBeenCalled();
  });
});
