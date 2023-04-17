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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getListTestSuites } from 'rest/testAPI';
import { MOCK_TABLE_DATA } from '../../mocks/TestSuite.mock';
import TestSuitePage from './TestSuitePage';

jest.mock('rest/testAPI', () => ({
  getListTestSuites: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE_DATA)),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
  })),
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="#">{children}</a>),
}));

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testSuite: {
        Delete: true,
        All: true,
      },
    },
  })),
}));

jest.mock('components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="DeleteWidgetModal">DeleteWidgetModal</div>
    ))
);

jest.mock('components/containers/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="pageLayoutV1">{children}</div>
    ))
);

jest.mock('../../utils/RouterUtils', () => ({
  getTestSuitePath: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('owner'),
  pluralize: jest.fn().mockReturnValue('0 Test'),
}));

jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader</div>);
});

jest.mock(
  'components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<p>TitleBreadCrumb</p>);
  }
);

jest.mock('components/common/next-previous/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});

jest.mock('components/common/next-previous/NextPrevious', () =>
  jest.fn().mockReturnValue(<p>NextPrevious</p>)
);

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>)
);

describe('Test Suite Page', () => {
  it('Component should render error placeholder when data is not present', async () => {
    (getListTestSuites as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [], paging: { total: 0 } })
    );
    await act(async () => {
      render(<TestSuitePage />, {
        wrapper: MemoryRouter,
      });
    });

    const errorPlaceHolder = await screen.findByText('ErrorPlaceHolder');

    expect(errorPlaceHolder).toBeInTheDocument();
  });

  it('Component should render with data', async () => {
    await act(async () => {
      render(<TestSuitePage />, {
        wrapper: MemoryRouter,
      });
    });

    const testSuitePage = await screen.findByTestId('pageLayoutV1');
    const addTestSuite = await screen.findByTestId('add-test-suite');
    const switchButton = await screen.findByTestId('switch-deleted');

    expect(testSuitePage).toBeInTheDocument();
    expect(addTestSuite).toBeInTheDocument();
    expect(switchButton).toBeInTheDocument();
  });

  it('Component should render table', async () => {
    await act(async () => {
      render(<TestSuitePage />, {
        wrapper: MemoryRouter,
      });
    });

    const testSuitePage = await screen.findByTestId('pageLayoutV1');
    const testSuiteTable = await screen.findByTestId('test-suite-table');

    expect(testSuitePage).toBeInTheDocument();
    expect(testSuiteTable).toBeInTheDocument();
  });

  it('Should render all table columns', async () => {
    await act(async () => {
      render(<TestSuitePage />, {
        wrapper: MemoryRouter,
      });
    });

    const table = await screen.findByTestId('test-suite-table');
    const nameColumn = await screen.findByText('label.name');
    const descriptionColumn = await screen.findByText('label.description');
    const testColumn = await screen.findByText('label.no-of-test');
    const ownerColumn = await screen.findByText('label.owner');
    const rows = await screen.findAllByRole('row');

    expect(table).toBeInTheDocument();
    expect(nameColumn).toBeInTheDocument();
    expect(testColumn).toBeInTheDocument();
    expect(ownerColumn).toBeInTheDocument();
    expect(descriptionColumn).toBeInTheDocument();

    expect(rows).toHaveLength(MOCK_TABLE_DATA.data.length + 1);
  });

  it('Component should render empty table on change to show deleted test suite', async () => {
    await act(async () => {
      render(<TestSuitePage />, {
        wrapper: MemoryRouter,
      });
    });
    const mockTestSuite = getListTestSuites as jest.Mock;

    expect(mockTestSuite.mock.calls[0][0]).toEqual({
      fields: 'owner,tests',
      limit: 15,
      before: undefined,
      after: undefined,
      include: 'non-deleted',
    });

    const switchButton = await screen.findByTestId('switch-deleted');
    await act(async () => {
      fireEvent.click(switchButton);
    });

    expect(mockTestSuite.mock.calls[1][0]).toEqual({
      fields: 'owner,tests',
      limit: 15,
      before: undefined,
      after: undefined,
      include: 'deleted',
    });
  });

  it('Should render Next Button when test suite is more than 15', async () => {
    await act(async () => {
      render(<TestSuitePage />, {
        wrapper: MemoryRouter,
      });
    });

    const rows = await screen.findAllByRole('row');
    const paginationContainer = await screen.findByText('NextPrevious');

    expect(rows).toHaveLength(MOCK_TABLE_DATA.paging.total + 1);
    expect(paginationContainer).toBeInTheDocument();
  });
});
