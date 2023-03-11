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
import { TestDefinition } from 'generated/tests/testDefinition';
import {
  MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN,
  MOCK_TABLE_WITH_DATE_TIME_COLUMNS,
} from 'mocks/TestSuite.mock';
import React from 'react';
import ParameterForm from './ParameterForm';

describe('ParameterForm component test', () => {
  it('Select box should render if "columnName" field is present and table data provided', async () => {
    await act(async () => {
      render(
        <ParameterForm
          definition={
            MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN as TestDefinition
          }
          table={MOCK_TABLE_WITH_DATE_TIME_COLUMNS}
        />
      );
    });

    const selectBox = await screen.findByRole('combobox');
    const parameters = await screen.findAllByTestId('parameter');

    expect(selectBox).toBeInTheDocument();
    expect(parameters).toHaveLength(
      MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN.parameterDefinition.length
    );
  });

  it('Select box should not render if "columnName" field is present but table data is not provided', async () => {
    await act(async () => {
      render(
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
});
