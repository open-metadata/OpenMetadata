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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { SearchIndex } from '../../enums/search.enum';
import {
  exportSearchResultsCsvStream,
  searchQuery,
} from '../../rest/searchAPI';
import {
  MOCK_EXPLORE_SEARCH_RESULTS,
  MOCK_EXPLORE_TAB_ITEMS,
} from '../Explore/Explore.mock';
import { ExploreSearchIndex } from '../Explore/ExplorePage.interface';
import ExploreV1 from './ExploreV1.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const Button = ({
    children,
    iconLeading,
    onClick,
    ...rest
  }: {
    children?: import('react').ReactNode;
    iconLeading?: import('react').ReactNode;
    onClick?: () => void;
  } & Record<string, unknown>) => (
    <button type="button" onClick={onClick} {...rest}>
      {iconLeading}
      {children}
    </button>
  );

  const Typography = ({
    children,
    ...rest
  }: {
    children?: import('react').ReactNode;
  } & Record<string, unknown>) => <span {...rest}>{children}</span>;

  const Card = ({
    children,
    isSelected,
    isClickable,
    onClick,
    ...rest
  }: {
    children?: import('react').ReactNode;
    isSelected?: boolean;
    isClickable?: boolean;
    onClick?: () => void;
  } & Record<string, unknown>) => (
    <div
      data-clickable={Boolean(isClickable)}
      data-selected={Boolean(isSelected)}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.();
        }
      }}
      {...rest}>
      {children}
    </div>
  );

  const Alert = ({
    title,
    ...rest
  }: {
    title?: import('react').ReactNode;
  } & Record<string, unknown>) => <span {...rest}>{title}</span>;

  return { Alert, Button, Card, Typography };
});

jest.mock('@untitledui/icons', () => ({
  Download01: () => <span data-testid="download-01-icon" />,
}));

jest.mock('../../rest/searchAPI', () => ({
  exportSearchResultsCsvStream: jest
    .fn()
    .mockResolvedValue(new Blob([''], { type: 'text/csv' })),
  searchQuery: jest.fn().mockResolvedValue({
    hits: { total: { value: 100 }, hits: [] },
  }),
}));

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
      queryFilter: undefined,
      onResetAllFilters: jest.fn(),
    })),
  })
);

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Modal: jest
    .fn()
    .mockImplementation(
      ({
        children,
        open,
        onCancel,
        onOk,
        okButtonProps,
        okText,
        cancelText,
        className,
        'data-testid': dataTestId,
      }: {
        children?: React.ReactNode;
        open?: boolean;
        onCancel?: () => void;
        onOk?: () => void;
        okButtonProps?: { disabled?: boolean };
        okText?: React.ReactNode;
        cancelText?: React.ReactNode;
        className?: string;
        'data-testid'?: string;
      }) =>
        open ? (
          <div className={className} data-testid={dataTestId} role="dialog">
            {children}
            <button type="button" onClick={onCancel}>
              {cancelText}
            </button>
            <button
              disabled={okButtonProps?.disabled}
              type="button"
              onClick={onOk}>
              {okText}
            </button>
          </div>
        ) : null
    ),
  Alert: jest
    .fn()
    .mockImplementation(({ message }: { message?: React.ReactNode }) => (
      <span>{message ?? 'Index Not Found Alert'}</span>
    )),
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
      table: {
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
    dataProduct: 0,
    table: 20,
    topic: 10,
    dashboard: 14,
    database: 1,
    databaseSchema: 1,
    pipeline: 0,
    mlmodel: 0,
    container: 0,
    storedProcedure: 0,
    dashboardDataModel: 0,
    glossaryTerm: 0,
    tag: 10,
    searchIndex: 9,
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

const mockThemeColors = {
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
};

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
    background: {
      paper: '#FFFFFF',
    },
  },
} as Parameters<typeof createTheme>[0]);

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('ExploreV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: { total: { value: 100 }, hits: [] },
    });
    (exportSearchResultsCsvStream as jest.Mock).mockResolvedValue(
      new Blob([''], { type: 'text/csv' })
    );
  });

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

  it('shows inline export error in modal and keeps modal open on export failure', async () => {
    const errorMessage = 'Export failed due to a server error.';
    (exportSearchResultsCsvStream as jest.Mock).mockRejectedValueOnce({
      response: {
        data: errorMessage,
      },
    });

    render(<ExploreV1 {...props} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId('export-search-results-button'));
    const modal = await screen.findByTestId('export-scope-modal');

    const exportButton = within(modal).getByRole('button', {
      name: 'label.export',
    });
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);

    expect(await within(modal).findByText(errorMessage)).toBeInTheDocument();
    expect(modal).toBeVisible();
  });

  it('disables export button while count is loading when modal opens', async () => {
    let resolveCountRequest:
      | ((value: { hits: { total: { value: number } } }) => void)
      | undefined;
    (searchQuery as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCountRequest = resolve;
        })
    );

    render(<ExploreV1 {...props} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId('export-search-results-button'));
    const modal = await screen.findByTestId('export-scope-modal');
    const exportButton = within(modal).getByRole('button', {
      name: 'label.export',
    });

    expect(exportButton).toBeDisabled();

    if (!resolveCountRequest) {
      throw new Error('Expected searchQuery resolver to be initialized');
    }

    resolveCountRequest({ hits: { total: { value: 100 } } });
    await waitFor(() => expect(exportButton).toBeEnabled());
  });

  it('disables export and shows alert when all matching assets exceed export limit', async () => {
    (searchQuery as jest.Mock).mockResolvedValueOnce({
      hits: { total: { value: 200001 }, hits: [] },
    });

    render(<ExploreV1 {...props} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId('export-search-results-button'));
    const modal = await screen.findByTestId('export-scope-modal');
    const exportButton = within(modal).getByRole('button', {
      name: 'label.export',
    });

    expect(
      await within(modal).findByText('message.export-assets-limit-exceeded')
    ).toBeInTheDocument();
    expect(exportButton).toBeDisabled();
  });
});
