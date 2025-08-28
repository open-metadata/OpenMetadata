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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { JsonTree, Utils } from '@react-awesome-query-builder/antd';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getTreeConfig } from '../../../utils/AdvancedSearchUtils';
import * as QueryBuilderElasticsearchFormatUtils from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import * as QueryBuilderUtils from '../../../utils/QueryBuilderUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilderWidgetV1 from './QueryBuilderWidgetV1';

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockImplementation(() =>
    Promise.resolve({
      hits: {
        total: {
          value: 42,
        },
      },
    })
  ),
}));
jest.mock('../../../utils/AdvancedSearchUtils', () => ({
  getEmptyJsonTreeForQueryBuilder: jest.fn(() => ({})),
  getTreeConfig: jest.fn().mockImplementation(() => ({
    fields: { test: 'field' },
    settings: { test: 'settings' },
  })),
}));

jest.mock('../../../utils/QueryBuilderUtils');
jest.mock('../../../utils/QueryBuilderElasticsearchFormatUtils');
jest.mock('../../../utils/RouterUtils', () => {
  return {
    getExplorePath: jest.fn().mockImplementation(() => '/explore'),
  };
});

// Mock i18n translation to return predictable strings
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'message.search-entity-count') {
        return `Found ${opts?.count ?? ''} resources`;
      }
      if (key === 'message.click-here-to-view-assets-on-explore') {
        return 'Click here to view assets on explore';
      }

      return key;
    },
  }),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn().mockImplementation(() => ({
      [EntityType.TABLE]: 'table_search_index',
      [EntityType.ALL]: 'all_search_index',
    })),
  },
}));

const mocks = {
  config: {
    fields: { test: 'field' },
    settings: { test: 'settings' },
  },
  treeInternal: {
    type: 'group',
    children1: {},
  },
};

jest.mock('@react-awesome-query-builder/antd', () => {
  const actual = jest.requireActual('@react-awesome-query-builder/antd');

  return {
    ...actual,
    Utils: {
      ...actual.Utils,
      getTree: jest.fn((tree) => tree),
      checkTree: jest.fn((tree) => tree),
      loadTree: jest.fn((tree) => tree || {}),
      sanitizeTree: jest.fn(() => ({ fixedTree: {} })),
      jsonLogicFormat: jest.fn(() => ({ logic: { test: 'logic' } })),
    },
    Builder: ({ onChange, ...props }: any) => (
      <div data-testid="query-builder" {...props}>
        <button
          data-testid="mock-query-change"
          onClick={() => onChange?.(mocks.treeInternal, mocks.config)}>
          Change Query
        </button>
      </div>
    ),
    Query: ({ onChange, renderBuilder, ...props }: any) => {
      const mockActions = { test: 'actions' };

      return (
        <div data-testid="awesome-query-builder">
          {renderBuilder({
            ...props,
            actions: mockActions,
            onChange: (tree: any, config: any) => onChange?.(tree, config),
          })}
        </div>
      );
    },
  };
});

const mockSearchResponse = {
  hits: {
    total: {
      value: 42,
    },
  },
};

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: any) => {
    fn.cancel = jest.fn();

    return fn;
  },
}));

describe('QueryBuilderWidgetV1', () => {
  const mockOnChange = jest.fn();
  const mockGetQueryActions = jest.fn();

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<QueryBuilderWidgetV1 />);

      expect(
        screen.getByTestId('query-builder-form-field')
      ).toBeInTheDocument();
      expect(screen.getByTestId('awesome-query-builder')).toBeInTheDocument();
    });

    it('should render with custom entity type', () => {
      render(<QueryBuilderWidgetV1 entityType={EntityType.TABLE} />);

      expect(
        screen.getByTestId('query-builder-form-field')
      ).toBeInTheDocument();
      expect(getTreeConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: 'table_search_index',
          searchOutputType: SearchOutputType.ElasticSearch,
          isExplorePage: false,
        })
      );
    });

    it('should render with JSONLogic output type and show label', () => {
      const label = 'Test Query Builder';
      render(
        <QueryBuilderWidgetV1
          label={label}
          outputType={SearchOutputType.JSONLogic}
        />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('should apply readonly settings when readonly prop is true', () => {
      render(<QueryBuilderWidgetV1 readonly />);

      expect(screen.getByTestId('awesome-query-builder')).toBeInTheDocument();
    });
  });

  describe('Query Building Functionality', () => {
    it('should handle tree updates for ElasticSearch output', async () => {
      (
        QueryBuilderElasticsearchFormatUtils.elasticSearchFormat as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });

      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          onChange={mockOnChange}
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      fireEvent.click(changeButton);

      expect(
        QueryBuilderElasticsearchFormatUtils.elasticSearchFormat
      ).toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenCalledWith('{"query":{"query":"test"}}');
    });

    it('should handle tree updates for JSONLogic output', async () => {
      (Utils.jsonLogicFormat as jest.Mock).mockImplementationOnce(() => {
        return {
          logic: {
            test: 'logic',
          },
        };
      });
      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.JSONLogic}
          onChange={mockOnChange}
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        '{"test":"logic"}',
        mocks.treeInternal
      );
    });

    it('should handle JSONLogic format errors gracefully', async () => {
      (Utils.jsonLogicFormat as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Format error');
      });

      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.JSONLogic}
          onChange={mockOnChange}
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith('', mocks.treeInternal);
    });

    it('should pass query actions to parent component', async () => {
      render(<QueryBuilderWidgetV1 getQueryActions={mockGetQueryActions} />);

      await waitFor(() => {
        expect(mockGetQueryActions).toHaveBeenCalledWith({ test: 'actions' });
      });
    });
  });

  describe('Search Results and Counting', () => {
    it('should fetch and display entity count for ElasticSearch output', async () => {
      (
        QueryBuilderElasticsearchFormatUtils.elasticSearchFormat as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });

      (QueryBuilderUtils.addEntityTypeFilter as jest.Mock).mockImplementation(
        (filter, entityType) => ({
          ...filter,
          entityType,
        })
      );

      (
        QueryBuilderUtils.getEntityTypeAggregationFilter as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });

      (searchQuery as jest.Mock).mockImplementationOnce(() => {
        return Promise.resolve(mockSearchResponse);
      });

      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test"}'
          onChange={mockOnChange}
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      fireEvent.click(changeButton);

      expect(searchQuery).toHaveBeenCalledWith({
        query: '',
        pageNumber: 0,
        pageSize: 0,
        queryFilter: {
          query: 'test',
        },
        searchIndex: 'all',
        includeDeleted: false,
        trackTotalHits: true,
        fetchSource: false,
      });

      expect(await screen.findByText('Found 42 resources')).toBeInTheDocument();

      jest.useRealTimers();
    });

    it('should show loading skeleton while fetching count', async () => {
      let resolveSearch: (value: any) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      (searchQuery as jest.Mock).mockReturnValue(searchPromise);

      (
        QueryBuilderElasticsearchFormatUtils.elasticSearchFormat as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });

      (QueryBuilderUtils.addEntityTypeFilter as jest.Mock).mockImplementation(
        (filter, entityType) => ({
          ...filter,
          entityType,
        })
      );

      (
        QueryBuilderUtils.getEntityTypeAggregationFilter as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });

      const { container } = render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      fireEvent.click(changeButton);

      expect(searchQuery).toHaveBeenCalled();

      expect(
        container.querySelector('.ant-skeleton.ant-skeleton-active')
      ).toBeInTheDocument();

      await act(async () => {
        resolveSearch(mockSearchResponse);
      });
    });

    it('should handle search API errors gracefully', async () => {
      (searchQuery as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      // Should not crash and should not show results
      await waitFor(() => {
        expect(screen.queryByText('Found')).not.toBeInTheDocument();
      });
    });

    it('should not show count for JSONLogic output type', async () => {
      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.JSONLogic}
          value='{"test": "value"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Found')).not.toBeInTheDocument();
      });
    });
  });

  describe('Explore Page Integration', () => {
    it('should create correct explore page URL', async () => {
      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      await waitFor(() => {
        const linkButton = screen.getByTestId('view-assets-banner-button');

        expect(linkButton).toHaveAttribute(
          'href',
          expect.stringContaining('/explore')
        );
      });
    });

    it('should open explore page in new tab when clicked', async () => {
      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      await waitFor(() => {
        const linkButton = screen.getByTestId('view-assets-banner-button');

        expect(linkButton).toHaveAttribute('target', '_blank');
      });
    });
  });

  describe('Props Handling', () => {
    it('should use custom fields when provided', () => {
      const customFields = {
        customField: {
          fieldName: 'customField',
          type: 'string',
        },
      };
      render(<QueryBuilderWidgetV1 fields={customFields} />);

      expect(screen.getByTestId('awesome-query-builder')).toBeInTheDocument();
    });

    it('should initialize with custom tree when provided', () => {
      const tree: JsonTree = {
        type: 'group',
        properties: {
          conjunction: 'AND',
          not: false,
        },
      };
      render(<QueryBuilderWidgetV1 tree={tree} />);

      expect(Utils.loadTree).toHaveBeenCalledWith(tree);
    });

    it('should handle undefined value prop', () => {
      render(<QueryBuilderWidgetV1 value={undefined} />);

      expect(
        screen.getByTestId('query-builder-form-field')
      ).toBeInTheDocument();
    });

    it('should handle empty value prop', () => {
      render(<QueryBuilderWidgetV1 value="" />);

      expect(
        screen.getByTestId('query-builder-form-field')
      ).toBeInTheDocument();
    });
  });

  describe('Debouncing', () => {
    it('should debounce API calls', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        hits: { total: { value: 42 } },
      });

      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test1"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      expect(searchQuery).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Found 42/)).toBeInTheDocument();
    });
  });

  describe('Entity Type Handling', () => {
    it('should handle different entity types correctly', () => {
      render(<QueryBuilderWidgetV1 entityType={EntityType.TABLE} />);

      expect(
        searchClassBase.getEntityTypeSearchIndexMapping
      ).toHaveBeenCalled();
      expect(getTreeConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: 'table_search_index',
        })
      );
    });

    it('should default to EntityType.ALL when no entity type provided', () => {
      render(<QueryBuilderWidgetV1 />);

      expect(getTreeConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: 'all_search_index',
        })
      );
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes for ElasticSearch output', () => {
      render(
        <QueryBuilderWidgetV1 outputType={SearchOutputType.ElasticSearch} />
      );

      const card = screen
        .getByTestId('query-builder-form-field')
        .querySelector('.query-builder-card');

      expect(card).toHaveClass('elasticsearch');
    });

    it('should apply correct CSS classes for JSONLogic output', () => {
      render(<QueryBuilderWidgetV1 outputType={SearchOutputType.JSONLogic} />);

      const card = screen
        .getByTestId('query-builder-form-field')
        .querySelector('.query-builder-card');

      expect(card).toHaveClass('jsonlogic');
    });

    it('should apply padding class for ElasticSearch output', () => {
      render(
        <QueryBuilderWidgetV1 outputType={SearchOutputType.ElasticSearch} />
      );

      const col = screen
        .getByTestId('query-builder-form-field')
        .querySelector('.ant-col');

      expect(col).toHaveClass('p-t-sm');
    });
  });

  describe('Configuration Updates', () => {
    it('should update config when tree changes', async () => {
      render(<QueryBuilderWidgetV1 />);

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      // Config should be updated internally
      expect(Utils.sanitizeTree).toHaveBeenCalled();
    });
  });

  describe('Error Boundary Cases', () => {
    it('should handle empty data gracefully', async () => {
      (
        QueryBuilderElasticsearchFormatUtils.elasticSearchFormat as jest.Mock
      ).mockReturnValue('');

      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          onChange={mockOnChange}
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('should handle null search response', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({ hits: { total: null } });
      (
        QueryBuilderElasticsearchFormatUtils.elasticSearchFormat as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });

      (QueryBuilderUtils.addEntityTypeFilter as jest.Mock).mockImplementation(
        (filter, entityType) => ({
          ...filter,
          entityType,
        })
      );

      (
        QueryBuilderUtils.getEntityTypeAggregationFilter as jest.Mock
      ).mockReturnValue({
        query: 'test',
      });
      render(
        <QueryBuilderWidgetV1
          outputType={SearchOutputType.ElasticSearch}
          value='{"query": "test"}'
        />
      );

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      expect(searchQuery).toHaveBeenCalled();

      expect(
        await screen.findByText((content) =>
          content.includes('Found 0 resources')
        )
      ).toBeInTheDocument();
    });
  });
});
