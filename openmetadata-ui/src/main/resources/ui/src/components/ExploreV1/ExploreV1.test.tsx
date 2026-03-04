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
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
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
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
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

jest.mock('../Explore/EntitySummaryPanel/EntitySummaryPanel.component', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="entity-summary-panel">EntitySummaryPanel</div>
    )
);

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../utils/CommonUtils', () => ({
  Transi18next: jest
    .fn()
    .mockImplementation(({ i18nKey, renderElement, values }) => (
      <div data-testid="trans-component">
        {i18nKey} {values && JSON.stringify(values)}
        {renderElement}
      </div>
    )),
}));

jest.mock('../../utils/AdvancedSearchUtils', () => ({
  getDropDownItems: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/EntityUtils', () => ({
  highlightEntityNameAndDescription: jest
    .fn()
    .mockImplementation((entity) => entity),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getApplicationDetailsPath: jest.fn().mockReturnValue('/settings'),
}));

jest.mock('../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getTabsInfo: jest.fn(() => ({
      table_search_index: {
        sortingFields: [],
      },
    })),
    getEntityLink: jest.fn().mockReturnValue('/test-entity'),
    getEntityIcon: jest.fn().mockReturnValue(<span>Icon</span>),
    getEntitySummaryComponent: jest.fn().mockReturnValue(null),
  },
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

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

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  blue: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    600: '#1677FF',
    700: '#0958D9',
  },
  blueGray: {
    50: '#F8FAFC',
  },
  gray: {
    300: '#D1D5DB',
    700: '#374151',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
    background: {
      paper: '#FFFFFF',
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('ExploreV1', () => {
  it('renders component without errors', async () => {
    render(<ExploreV1 {...props} />, { wrapper: Wrapper });

    expect(screen.getByText('ExploreTree')).toBeInTheDocument();
  });

  it('changes sort order when sort button is clicked', () => {
    render(<ExploreV1 {...props} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId('sort-order-button'));

    expect(onChangeSortOder).toHaveBeenCalled();
  });

  it('should show the index not found alert, if get isElasticSearchIssue true in prop', () => {
    render(<ExploreV1 {...props} isElasticSearchIssue />, { wrapper: Wrapper });

    expect(screen.getByText('Index Not Found Alert')).toBeInTheDocument();

    expect(screen.queryByText('SearchedData')).not.toBeInTheDocument();
  });
});
