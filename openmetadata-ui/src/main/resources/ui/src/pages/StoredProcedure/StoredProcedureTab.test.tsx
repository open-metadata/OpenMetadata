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
  useParams: jest.fn().mockImplementation(() => ({ fqn: 'something' })),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation(() => 'displayName'),
}));

jest.mock('../../utils/StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  getErrorText: jest.fn().mockImplementation(() => 'test'),
}));

jest.mock('../../utils/TableUtils', () => ({
  getEntityLink: jest.fn().mockImplementation((link) => link),
  getTableExpandableConfig: jest.fn(),
}));

jest.mock('../../rest/storedProceduresAPI', () => {
  return {
    getStoredProceduresList: jest
      .fn()
      .mockResolvedValue({ data: [], paging: { total: 0 } }),
  };
});

describe('StoredProcedureTab component', () => {
  it('StoredProcedureTab should render components', () => {
    render(<StoredProcedureTab />);

    expect(screen.getByTestId('stored-procedure-table')).toBeInTheDocument();
    expect(
      screen.getByTestId('show-deleted-stored-procedure')
    ).toBeInTheDocument();
    expect(screen.queryByText('testNextPrevious')).not.toBeInTheDocument();
  });

  it('show deleted switch handler show properly', () => {
    render(<StoredProcedureTab />);

    const showDeletedHandler = screen.getByTestId(
      'show-deleted-stored-procedure'
    );

    expect(showDeletedHandler).toBeInTheDocument();

    fireEvent.click(showDeletedHandler);
  });
});
