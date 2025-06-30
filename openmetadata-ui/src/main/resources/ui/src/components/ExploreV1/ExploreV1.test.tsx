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
import { SearchIndex } from '../../enums/search.enum';
import {
  MOCK_EXPLORE_SEARCH_RESULTS,
  MOCK_EXPLORE_TAB_ITEMS,
} from '../Explore/Explore.mock';
import { ExploreSearchIndex } from '../Explore/ExplorePage.interface';
import ExploreV1 from './ExploreV1.component';

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ search: '' }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

jest.mock('../Explore/ExploreTree/ExploreTree', () => {
  return jest.fn().mockImplementation(() => <div>ExploreTree</div>);
});

jest.mock('../common/ResizablePanels/ResizablePanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ));
});

jest.mock('../common/ResizablePanels/ResizableLeftPanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ));
});

jest.mock('./ExploreSearchCard/ExploreSearchCard', () => {
  return jest.fn().mockReturnValue(<p>ExploreSearchCard</p>);
});

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    searchCriteria: '',
    theme: {
      primaryColor: '#000000',
      errorColor: '#000000',
    },
  })),
}));

jest.mock(
  '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockImplementation(() => ({
      toggleModal: jest.fn(),
      sqlQuery: '',
      onResetAllFilters: jest.fn(),
    })),
  })
);

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Alert: jest.fn().mockReturnValue(<span>Index Not Found Alert</span>),
}));

jest.mock('../SearchedData/SearchedData', () =>
  jest.fn().mockReturnValue(<div>SearchedData</div>)
);

const onChangeAdvancedSearchQuickFilters = jest.fn();
const onChangeSearchIndex = jest.fn();
const onChangeSortOder = jest.fn();
const onChangeSortValue = jest.fn();
const onChangeShowDeleted = jest.fn();
const onChangePage = jest.fn();

const props = {
  aggregations: {},
  searchResults: MOCK_EXPLORE_SEARCH_RESULTS,
  tabItems: MOCK_EXPLORE_TAB_ITEMS,
  activeTabKey: SearchIndex.TABLE,
  tabCounts: {
    data_product_search_index: 0,
    table_search_index: 20,
    topic_search_index: 10,
    dashboard_search_index: 14,
    database_search_index: 1,
    database_schema_search_index: 1,
    pipeline_search_index: 0,
    mlmodel_search_index: 0,
    container_search_index: 0,
    stored_procedure_search_index: 0,
    dashboard_data_model_search_index: 0,
    glossary_term_search_index: 0,
    tag_search_index: 10,
    search_entity_search_index: 9,
  },
  onChangeAdvancedSearchQuickFilters: onChangeAdvancedSearchQuickFilters,
  searchIndex: SearchIndex.TABLE as ExploreSearchIndex,
  onChangeSearchIndex: onChangeSearchIndex,
  sortOrder: '',
  onChangeSortOder: onChangeSortOder,
  sortValue: '',
  onChangeSortValue: onChangeSortValue,
  onChangeShowDeleted: onChangeShowDeleted,
  showDeleted: false,
  onChangePage: onChangePage,
  loading: false,
  quickFilters: {
    query: {
      bool: {},
    },
  },
};

describe('ExploreV1', () => {
  it('renders component without errors', async () => {
    render(<ExploreV1 {...props} />);

    expect(screen.getByText('ExploreTree')).toBeInTheDocument();
  });

  it('changes sort order when sort button is clicked', () => {
    render(<ExploreV1 {...props} />);

    fireEvent.click(screen.getByTestId('sort-order-button'));

    expect(onChangeSortOder).toHaveBeenCalled();
  });

  it('should show the index not found alert, if get isElasticSearchIssue true in prop', () => {
    render(<ExploreV1 {...props} isElasticSearchIssue />);

    expect(screen.getByText('Index Not Found Alert')).toBeInTheDocument();

    expect(screen.queryByText('SearchedData')).not.toBeInTheDocument();
  });
});
