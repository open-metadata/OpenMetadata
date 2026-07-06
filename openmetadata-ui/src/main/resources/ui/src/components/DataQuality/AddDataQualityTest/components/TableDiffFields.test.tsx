/*
 *  Copyright 2025 Collate.
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
import { HookForm } from '@openmetadata/ui-core-components';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { Table } from '../../../../generated/entity/data/table';
import {
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import { searchQuery } from '../../../../rest/searchAPI';
import TableDiffFields, {
  restoreParamName,
  sanitizeParamName,
} from './TableDiffFields';
import { FormValues } from './TestCaseFormV1.interface';

jest.mock('@untitledui/icons', () => ({
  Trash01: () => <span data-testid="trash-icon" />,
}));

const capturedFieldOptions: Record<
  string,
  Array<{ id: string; isDisabled?: boolean }>
> = {};

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    getField: (config: {
      name?: string;
      props?: { options?: Array<{ id: string; isDisabled?: boolean }> };
    }) => {
      if (config.name && config.props?.options) {
        capturedFieldOptions[config.name] = config.props.options;
      }

      return actual.getField(config);
    },
  };
});

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

const TABLE2_FQN = 'service.db.schema.orders';

const SEARCH_RESPONSE = {
  hits: {
    hits: [
      {
        _source: {
          name: 'orders',
          fullyQualifiedName: TABLE2_FQN,
          columns: [
            { name: 'order_id', dataType: 'BIGINT' },
            { name: 'amount', dataType: 'DECIMAL' },
          ],
        },
      },
    ],
  },
};

const TABLE_DIFF_DEFINITION = {
  name: 'tableDiff',
  fullyQualifiedName: 'tableDiff',
  parameterDefinition: [
    { name: 'table2', displayName: 'Table 2', dataType: TestDataType.String },
    {
      name: 'keyColumns',
      displayName: 'Key Columns',
      dataType: TestDataType.Array,
    },
    {
      name: 'table2.keyColumns',
      displayName: 'Table 2 Key Columns',
      dataType: TestDataType.Array,
    },
    {
      name: 'useColumns',
      displayName: 'Use Columns',
      dataType: TestDataType.Array,
    },
  ],
} as TestDefinition;

const MAIN_TABLE = {
  columns: [
    { name: 'id', dataType: 'BIGINT' },
    { name: 'name', dataType: 'VARCHAR' },
  ],
} as Table;

let formRef: UseFormReturn<FormValues> | undefined;

const renderFields = (table?: Table) => {
  const Wrapper = () => {
    const form = useForm<FormValues>();
    formRef = form;

    return (
      <HookForm form={form} onSubmit={jest.fn()}>
        <TableDiffFields
          definition={TABLE_DIFF_DEFINITION}
          form={form}
          table={table}
        />
      </HookForm>
    );
  };

  return render(<Wrapper />);
};

const isColumnSelectDisabled = (testId: string): boolean =>
  screen.getByTestId(testId).getAttribute('data-disabled') === 'true';

describe('TableDiffFields', () => {
  beforeEach(() => {
    formRef = undefined;
    mockSearchQuery.mockResolvedValue(SEARCH_RESPONSE as never);
    Object.keys(capturedFieldOptions).forEach(
      (key) => delete capturedFieldOptions[key]
    );
  });

  it('renders the table2 async select', async () => {
    await act(async () => {
      renderFields(MAIN_TABLE);
    });

    expect(await screen.findByTestId('table2')).toBeInTheDocument();
  });

  it('keeps the table2.keyColumns select disabled until table2 is selected', async () => {
    await act(async () => {
      renderFields(MAIN_TABLE);
    });

    await screen.findByTestId('table2');

    expect(isColumnSelectDisabled('parameter-table2.keyColumns-0')).toBe(true);
  });

  it('loads table2 columns and enables table2.keyColumns once table2 is selected', async () => {
    await act(async () => {
      renderFields(MAIN_TABLE);
    });

    await screen.findByTestId('table2');

    await act(async () => {
      formRef?.setValue(
        'params.table2' as never,
        {
          id: TABLE2_FQN,
          label: TABLE2_FQN,
        } as never
      );
    });

    await waitFor(() => {
      expect(isColumnSelectDisabled('parameter-table2.keyColumns-0')).toBe(
        false
      );
    });

    const options = screen
      .getAllByRole('option', { hidden: true })
      .map((option) => option.textContent);

    expect(options).toContain('order_id');
    expect(options).toContain('amount');
  });

  it('disables table2.keyColumns again when table2 is cleared', async () => {
    await act(async () => {
      renderFields(MAIN_TABLE);
    });

    await screen.findByTestId('table2');

    await act(async () => {
      formRef?.setValue(
        'params.table2' as never,
        {
          id: TABLE2_FQN,
          label: TABLE2_FQN,
        } as never
      );
    });

    await waitFor(() => {
      expect(isColumnSelectDisabled('parameter-table2.keyColumns-0')).toBe(
        false
      );
    });

    await act(async () => {
      formRef?.setValue('params.table2' as never, null as never);
    });

    await waitFor(() => {
      expect(isColumnSelectDisabled('parameter-table2.keyColumns-0')).toBe(
        true
      );
    });
  });

  it('disables a column in useColumns once it is selected in keyColumns, and vice versa', async () => {
    await act(async () => {
      renderFields(MAIN_TABLE);
    });

    await screen.findByTestId('table2');

    await act(async () => {
      formRef?.setValue(
        'params.keyColumns' as never,
        [{ value: 'id' }] as never
      );
    });

    await waitFor(() => {
      const useColumnsOptions =
        capturedFieldOptions['params.useColumns.0.value'];

      expect(useColumnsOptions).toBeDefined();

      const idOption = useColumnsOptions?.find((opt) => opt.id === 'id');

      expect(idOption?.isDisabled).toBe(true);
    });

    await act(async () => {
      formRef?.setValue(
        'params.keyColumns' as never,
        [{ value: undefined }] as never
      );
      formRef?.setValue(
        'params.useColumns' as never,
        [{ value: 'name' }] as never
      );
    });

    await waitFor(() => {
      const keyColumnsOptions =
        capturedFieldOptions['params.keyColumns.0.value'];

      expect(keyColumnsOptions).toBeDefined();

      const nameOption = keyColumnsOptions?.find((opt) => opt.id === 'name');

      expect(nameOption?.isDisabled).toBe(true);
    });
  });

  it('stores table2.keyColumns under a sanitized key that restores to the literal dotted name without colliding with params.table2', async () => {
    await act(async () => {
      renderFields(MAIN_TABLE);
    });

    await screen.findByTestId('table2');

    const sanitizedKey = sanitizeParamName('table2.keyColumns');

    await act(async () => {
      formRef?.setValue(
        'params.table2' as never,
        {
          id: TABLE2_FQN,
          label: TABLE2_FQN,
        } as never
      );
    });

    await act(async () => {
      formRef?.setValue(
        `params.${sanitizedKey}` as never,
        [{ value: 'order_id' }] as never
      );
    });

    const params = formRef?.getValues().params as Record<string, unknown>;

    expect(params[sanitizedKey]).toEqual([{ value: 'order_id' }]);
    expect(restoreParamName(sanitizedKey)).toBe('table2.keyColumns');
    expect(params.table2).toEqual({ id: TABLE2_FQN, label: TABLE2_FQN });
    expect(params['table2.keyColumns']).toBeUndefined();
  });
});
