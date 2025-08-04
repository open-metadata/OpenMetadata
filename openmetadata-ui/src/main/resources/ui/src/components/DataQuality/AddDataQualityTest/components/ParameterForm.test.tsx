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

import { act, render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { EntityReference } from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import {
  MOCK_TABLE_COLUMN_NAME_TO_EXIST,
  MOCK_TABLE_CUSTOM_SQL_QUERY,
  MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN,
  MOCK_TABLE_TEST_WITH_COLUMN,
  MOCK_TABLE_WITH_DATE_TIME_COLUMNS,
} from '../../../../mocks/TestSuite.mock';
import ParameterForm from './ParameterForm';

jest.mock('../../../Database/SchemaEditor/CodeEditor', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="code-editor">CodeEditor</div>);
});

jest.mock('../../../../constants/LeftSidebar.constants', () => ({
  SIDEBAR_LIST: [],
  SIDEBAR_NESTED_KEYS: {},
}));

jest.mock('../../../../constants/profiler.constant', () => ({
  SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME: [],
  DEFAULT_SELECTED_RANGE: {
    key: 'last7Days',
    title: 'Last 7 days',
    days: 7,
  },
}));
jest.mock('../../../../constants/constants', () => ({
  PAGE_SIZE_LARGE: 50,
  PLACEHOLDER_ROUTE_TAB: ':tab',
  ROUTES: {
    OBSERVABILITY_ALERTS: '/observability/alerts',
    DATA_INSIGHT: '/data-insights',
    DATA_INSIGHT_WITH_TAB: '/data-insights/:tab',
  },
}));
jest.mock('../../../../utils/EntityUtils', () => {
  return {
    getEntityName: jest
      .fn()
      .mockImplementation(
        (data: EntityReference) => data.displayName ?? data.name
      ),
  };
});

jest.mock('../../../../rest/searchAPI', () => {
  return {
    searchQuery: jest.fn().mockResolvedValue({
      hits: {
        hits: [],
      },
    }),
  };
});

const renderWithForm = (component: React.ReactElement) => {
  return render(<Form>{component}</Form>);
};

describe('ParameterForm component test', () => {
  it('Select box should render if "columnName" field is present and table data provided', async () => {
    await act(async () => {
      renderWithForm(
        <ParameterForm
          definition={
            MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN as TestDefinition
          }
          table={MOCK_TABLE_WITH_DATE_TIME_COLUMNS}
        />
      );
    });
    // test definition should be "tableRowInsertedCountToBeBetween"
    const selectBox = await screen.findByRole('combobox');
    const parameters = await screen.findAllByTestId('parameter');

    expect(selectBox).toBeInTheDocument();
    expect(parameters).toHaveLength(
      MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN.parameterDefinition.length
    );
  });

  it('Select box should render if "column" field is present and table data provided', async () => {
    await act(async () => {
      renderWithForm(
        <ParameterForm
          definition={MOCK_TABLE_TEST_WITH_COLUMN as TestDefinition}
          table={MOCK_TABLE_WITH_DATE_TIME_COLUMNS}
        />
      );
    });
    // test definition should be "tableRowInsertedCountToBeBetween"
    const selectBox = await screen.findByRole('combobox');
    const parameters = await screen.findAllByTestId('parameter');

    expect(selectBox).toBeInTheDocument();
    expect(parameters).toHaveLength(
      MOCK_TABLE_TEST_WITH_COLUMN.parameterDefinition.length
    );
  });

  it('Select box should not render if "columnName" field is present but table data is not provided', async () => {
    await act(async () => {
      renderWithForm(
        <ParameterForm
          definition={
            MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN as TestDefinition
          }
        />
      );
    });

    const selectBox = screen.queryByRole('combobox');
    const parameters = await screen.findAllByTestId('parameter');

    expect(selectBox).not.toBeInTheDocument();
    expect(parameters).toHaveLength(
      MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN.parameterDefinition.length
    );
  });

  it('Select box should not render if "columnName" field is present but test definition is not "tableRowInsertedCountToBeBetween"', async () => {
    await act(async () => {
      renderWithForm(
        <ParameterForm
          definition={MOCK_TABLE_COLUMN_NAME_TO_EXIST as TestDefinition}
          table={MOCK_TABLE_WITH_DATE_TIME_COLUMNS}
        />
      );
    });

    const selectBox = screen.queryByRole('combobox');
    const parameters = await screen.findAllByTestId('parameter');

    expect(selectBox).not.toBeInTheDocument();
    expect(parameters).toHaveLength(
      MOCK_TABLE_COLUMN_NAME_TO_EXIST.parameterDefinition.length
    );
  });

  it('Query editor should render if "sqlExpression" field is present', async () => {
    await act(async () => {
      renderWithForm(
        <ParameterForm
          definition={MOCK_TABLE_CUSTOM_SQL_QUERY as TestDefinition}
        />
      );
    });

    const codeEditor = await screen.findByTestId('code-editor');

    expect(codeEditor).toBeInTheDocument();
  });

  it('Should render select box if optionValues are provided', async () => {
    await act(async () => {
      renderWithForm(
        <ParameterForm
          definition={MOCK_TABLE_CUSTOM_SQL_QUERY as TestDefinition}
        />
      );
    });

    const selectBox = await screen.findByRole('combobox');

    expect(selectBox).toBeInTheDocument();
  });
});
