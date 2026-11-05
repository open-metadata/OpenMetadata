/*
 *  Copyright 2026 Collate.
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
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { SearchOutputType } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilderWidget from './QueryBuilderWidget';

const advanceSearchContext = {
  toggleModal: jest.fn(),
  sqlQuery: '',
  onResetAllFilters: jest.fn(),
  onChangeSearchIndex: jest.fn(),
  isUpdating: false,
  searchIndex: SearchIndex.TABLE,
  config: { fields: { fromProvider: { label: 'From provider' } } },
};

jest.mock(
  '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useAdvanceSearch: jest.fn(() => advanceSearchContext),
  })
);

jest.mock('../../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn(() => ({
      table: 'table',
      all: 'all',
    })),
  },
}));

// The adapter's whole job is the props mapping, so the canonical component is
// stubbed and the props it receives are the assertion.
const queryBuilderProps = jest.fn();
jest.mock('../../../../QueryBuilder/QueryBuilder', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    queryBuilderProps(props);

    return <div data-testid="canonical-query-builder" />;
  },
}));

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
}));

const baseProps = {
  onFocus: jest.fn(),
  onBlur: jest.fn(),
  onChange: jest.fn(),
  registry: {} as Registry,
  schema: {
    description: 'this is query builder field',
    title: 'rules',
    format: 'queryBuilder',
    entityType: EntityType.TABLE,
  },
  value: '',
  id: 'root/queryBuilder',
  label: 'Query Builder',
  name: 'queryBuilder',
  options: { enumOptions: [] },
};

const renderWidget = (overrides = {}) =>
  render(<QueryBuilderWidget {...baseProps} {...overrides} />);

const lastProps = () => queryBuilderProps.mock.calls.at(-1)?.[0];

describe('QueryBuilderWidget', () => {
  beforeEach(() => {
    advanceSearchContext.isUpdating = false;
    advanceSearchContext.searchIndex = SearchIndex.TABLE;
  });

  it('should render the canonical query builder', () => {
    renderWidget();

    expect(screen.getByTestId('canonical-query-builder')).toBeInTheDocument();
  });

  describe('WidgetProps mapping', () => {
    it('should take the entity type from the schema', () => {
      renderWidget();

      expect(lastProps().entityType).toBe(EntityType.TABLE);
    });

    it('should let formContext override the schema entity type', () => {
      // EntityType.ALL resolves to the DATA_ASSET index, so the provider has
      // to be on that index for the builder to mount at all.
      advanceSearchContext.searchIndex = SearchIndex.DATA_ASSET;
      renderWidget({
        formContext: { entityType: EntityType.ALL },
        schema: { ...baseProps.schema, entityType: EntityType.TABLE },
      });

      expect(lastProps().entityType).toBe(EntityType.ALL);
    });

    it('should default to Elasticsearch output', () => {
      renderWidget();

      expect(lastProps().outputType).toBe(SearchOutputType.ElasticSearch);
    });

    it('should map schema.outputType', () => {
      renderWidget({
        schema: {
          ...baseProps.schema,
          outputType: SearchOutputType.JSONLogic,
        },
      });

      expect(lastProps().outputType).toBe(SearchOutputType.JSONLogic);
    });

    it('should show the explore link by default and honour schema opt-out', () => {
      renderWidget();

      expect(lastProps().showExploreLink).toBe(true);

      renderWidget({
        schema: { ...baseProps.schema, showExploreLink: false },
      });

      expect(lastProps().showExploreLink).toBe(false);
    });

    it('should forward defaultField, subField, label and readonly', () => {
      renderWidget({
        defaultField: 'tags',
        subField: 'tagFQN',
        readonly: true,
      });

      expect(lastProps()).toEqual(
        expect.objectContaining({
          defaultField: 'tags',
          subField: 'tagFQN',
          label: 'Query Builder',
          readonly: true,
        })
      );
    });

    it('should never offer user-created groups', () => {
      renderWidget();

      expect(lastProps().groupMode).toBe('flat');
    });

    it('should pass the value straight back out on change', () => {
      const onChange = jest.fn();
      renderWidget({ onChange });

      lastProps().onChange('{"query":{}}');

      expect(onChange).toHaveBeenCalledWith('{"query":{}}');
    });
  });

  describe('fields', () => {
    it("should use the provider's enriched fields", () => {
      renderWidget();

      expect(Object.keys(lastProps().fields)).toEqual(['fromProvider']);
    });

    it('should let an explicit fields prop win', () => {
      renderWidget({ fields: { explicit: { label: 'Explicit' } } });

      expect(Object.keys(lastProps().fields)).toEqual(['explicit']);
    });
  });

  describe('search index', () => {
    beforeEach(() => {
      advanceSearchContext.onChangeSearchIndex.mockClear();
    });

    it('should point the provider at the index for its entity type', () => {
      renderWidget();

      expect(advanceSearchContext.onChangeSearchIndex).toHaveBeenCalledWith(
        SearchIndex.TABLE
      );
    });

    it('should follow the entity type when it changes', () => {
      const { rerender } = render(
        <QueryBuilderWidget
          {...baseProps}
          schema={{ entityType: EntityType.API_COLLECTION }}
        />
      );

      advanceSearchContext.onChangeSearchIndex.mockClear();

      rerender(
        <QueryBuilderWidget
          {...baseProps}
          schema={{ entityType: EntityType.TABLE }}
        />
      );

      expect(advanceSearchContext.onChangeSearchIndex).toHaveBeenCalledWith(
        SearchIndex.TABLE
      );
    });

    it('should not re-notify the provider when the entity type is unchanged', () => {
      const { rerender } = render(<QueryBuilderWidget {...baseProps} />);

      advanceSearchContext.onChangeSearchIndex.mockClear();
      rerender(<QueryBuilderWidget {...baseProps} />);

      expect(advanceSearchContext.onChangeSearchIndex).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('should not mount the builder until the provider has this index loaded', () => {
      advanceSearchContext.searchIndex = SearchIndex.DASHBOARD;
      renderWidget();

      expect(
        screen.queryByTestId('canonical-query-builder')
      ).not.toBeInTheDocument();
    });

    it('should not mount the builder while the provider is updating', () => {
      advanceSearchContext.isUpdating = true;
      renderWidget();

      expect(
        screen.queryByTestId('canonical-query-builder')
      ).not.toBeInTheDocument();
    });
  });
});
