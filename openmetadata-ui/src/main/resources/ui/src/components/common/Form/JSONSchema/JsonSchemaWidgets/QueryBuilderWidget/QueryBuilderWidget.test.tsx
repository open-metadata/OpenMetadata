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
import { AntdConfig, ImmutableTree } from '@react-awesome-query-builder/antd';
import { Registry } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SearchIndex } from '../../../../../../enums/search.enum';
import jsonLogicSearchClassBase from '../../../../../../utils/JSONLogicSearchClassBase';
import { useAdvanceSearch } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { SearchOutputType } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilderWidget from './QueryBuilderWidget';

const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();
const mockOnChange = jest.fn();
const baseConfig = AntdConfig;

jest.mock(
  '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="query-builder-form-field">{children}</div>
    ),
    useAdvanceSearch: jest.fn().mockImplementation(() => ({
      toggleModal: jest.fn(),
      sqlQuery: '',
      onResetAllFilters: jest.fn(),
      onChangeSearchIndex: jest.fn(),
      config: {
        ...baseConfig,
        fields: {},
      },
    })),
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
    render(<QueryBuilderWidget {...mockProps} />);
    const builder = screen.getByTestId('query-builder-form-field');

    expect(builder).toBeInTheDocument();
  });
});

describe('QueryBuilderWidget – negated JSON Logic rules', () => {
  const tagIs = (fqn: string) => ({
    some: [{ var: 'tags' }, { '==': [{ var: 'tagFQN' }, fqn] }],
  });

  const renderRule = (rule: unknown) => {
    const config = jsonLogicSearchClassBase.getQbConfigs([
      SearchIndex.GLOSSARY_TERM,
    ]);
    // The provider owns the tree; this keeps it in state so the widget re-renders the loaded rule.
    (useAdvanceSearch as jest.Mock).mockImplementation(() => {
      const [treeInternal, setTreeInternal] = React.useState<ImmutableTree>();

      return {
        onChangeSearchIndex: jest.fn(),
        searchIndex: SearchIndex.GLOSSARY_TERM,
        isUpdating: false,
        config,
        treeInternal,
        onTreeUpdate: (tree: ImmutableTree) => setTreeInternal(tree),
      };
    });

    return render(
      <QueryBuilderWidget
        {...mockProps}
        schema={{
          ...mockProps.schema,
          entityType: 'glossaryTerm',
          outputType: SearchOutputType.JSONLogic,
        }}
        value={JSON.stringify(rule)}
      />
    );
  };

  it('shows the NOT of a rule written through the API around several conditions', () => {
    const { container } = renderRule({
      '!': { and: [tagIs('A'), tagIs('B')] },
    });

    expect(container.querySelector('.group--conjunctions')).toHaveTextContent(
      /not/i
    );
  });

  it('shows no NOT once a negated single rule loads as an "Is Not" row', () => {
    const { container } = renderRule({ '!': { and: [tagIs('A')] } });

    expect(
      container.querySelector('.group--conjunctions')
    ).not.toHaveTextContent(/not/i);
    expect(screen.getByText('label.is-not')).toBeInTheDocument();
  });
});
