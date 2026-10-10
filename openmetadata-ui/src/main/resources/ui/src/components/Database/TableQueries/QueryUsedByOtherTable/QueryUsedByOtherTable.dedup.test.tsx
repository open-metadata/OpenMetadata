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
import { render, screen, waitFor } from '@testing-library/react';
import { Select, SelectProps } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { MemoryRouter } from 'react-router-dom';

import { Query } from '../../../../generated/entity/data/query';
import QueryUsedByOtherTable from './QueryUsedByOtherTable.component';

const mockSearchQuery = jest.fn();

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

interface CapturedOption extends DefaultOptionType {
  value: string;
  labelName: string;
}

interface CapturedAsyncSelectProps {
  options?: CapturedOption[];
  defaultValue?: SelectProps['defaultValue'];
  optionLabelProp?: SelectProps['optionLabelProp'];
  mode?: SelectProps['mode'];
  'data-testid'?: string;
}

let capturedOptions: CapturedOption[] | undefined;

jest.mock('../../../common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: (props: CapturedAsyncSelectProps) => {
    capturedOptions = props.options;

    return (
      <Select
        data-testid={props['data-testid']}
        defaultValue={props.defaultValue}
        mode={props.mode}
        optionLabelProp={props.optionLabelProp}
        options={props.options}
      />
    );
  },
}));

describe('QueryUsedByOtherTable: same-name selection dedup regression', () => {
  beforeEach(() => {
    capturedOptions = undefined;
    mockSearchQuery.mockResolvedValue({ hits: { hits: [] } });
  });

  it('keeps both same-name selected tables in initialOptions and renders table names as chips', async () => {
    const query = {
      id: 'query-1',
      queryUsedIn: [
        {
          id: 'id-A',
          name: 'users',
          fullyQualifiedName: 'svc.db.schema1.users',
          type: 'table',
        },
        {
          id: 'id-B',
          name: 'users',
          fullyQualifiedName: 'svc.db.schema2.users',
          type: 'table',
        },
      ],
    } as unknown as Query;

    render(
      <QueryUsedByOtherTable isEditMode query={query} onChange={jest.fn()} />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => expect(capturedOptions).toHaveLength(2));

    const idsInOptions = (capturedOptions ?? []).map((option) => option.value);

    expect(idsInOptions).toEqual(['id-A', 'id-B']);
    expect(capturedOptions?.map((option) => option.labelName)).toEqual([
      'users',
      'users',
    ]);

    expect(screen.queryByText('id-A')).not.toBeInTheDocument();
    expect(screen.queryByText('id-B')).not.toBeInTheDocument();
  });

  it('still removes a true duplicate (same id) appearing in both selection and search results', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'id-A',
              name: 'users',
              fullyQualifiedName: 'svc.db.schema1.users',
              entityType: 'table',
              type: 'table',
            },
          },
        ],
      },
    });

    const query = {
      id: 'query-1',
      queryUsedIn: [
        {
          id: 'id-A',
          name: 'users',
          fullyQualifiedName: 'svc.db.schema1.users',
          type: 'table',
        },
        {
          id: 'id-B',
          name: 'users',
          fullyQualifiedName: 'svc.db.schema2.users',
          type: 'table',
        },
      ],
    } as unknown as Query;

    render(
      <QueryUsedByOtherTable isEditMode query={query} onChange={jest.fn()} />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => expect(capturedOptions).toHaveLength(2));

    const idsInOptions = (capturedOptions ?? []).map((option) => option.value);

    expect(idsInOptions).toEqual(['id-A', 'id-B']);
    expect(idsInOptions.filter((id) => id === 'id-A')).toHaveLength(1);
  });
});
