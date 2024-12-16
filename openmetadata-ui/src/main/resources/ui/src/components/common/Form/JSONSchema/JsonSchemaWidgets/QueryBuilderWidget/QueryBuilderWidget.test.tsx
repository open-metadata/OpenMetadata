/*
 *  Copyright 2024 Collate.
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
import { Registry } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BasicConfig } from 'react-awesome-query-builder';
import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
import { withAdvanceSearch } from '../../../../../AppRouter/withAdvanceSearch';
import QueryBuilderWidget from './QueryBuilderWidget';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();
const baseConfig = AntdConfig as BasicConfig;

jest.mock(
  '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockImplementation(() => ({
      toggleModal: jest.fn(),
      isExplorePage: false,
      sqlQuery: '',
      searchIndex: 'table_search_index',
      onResetAllFilters: jest.fn(),
      onChangeSearchIndex: jest.fn(),
      onTreeUpdate: jest.fn(),
      config: {
        ...baseConfig,
        fields: {},
      },
    })),
    AdvanceSearchProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
}));

const mockProps = {
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  onChange: mockOnChange,
  registry: {} as Registry,
  schema: {
    description: 'this is query builder field',
    title: 'rules',
    format: 'queryBuilder',
    entityType: 'table',
  },
  value: '',
  id: 'root/queryBuilder',
  label: 'Query Builder',
  name: 'queryBuilder',
  options: {
    enumOptions: [],
  },
};

describe('QueryBuilderWidget', () => {
  it('should render the query builder', () => {
    const QueryBuilderWidgetWithProvider = withAdvanceSearch(
      QueryBuilderWidget,
      { isExplorePage: false }
    );
    render(<QueryBuilderWidgetWithProvider {...mockProps} />);
    const builder = screen.getByTestId('query-builder-form-field');

    expect(builder).toBeInTheDocument();
  });
});
