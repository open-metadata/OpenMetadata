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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useEntityRules } from '../../../hooks/useEntityRules';
import DataProductsSection from './DataProductsSection';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
  useParams: jest.fn().mockReturnValue({}),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock custom location hook
jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Partial mock antd to preserve DatePicker and others used transitively
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');

  return {
    ...actual,
    Button: jest.fn().mockImplementation(({ children, ...props }) => (
      <button data-testid="button" {...props}>
        {children}
      </button>
    )),
    Typography: {
      ...actual.Typography,
      Text: jest
        .fn()
        .mockImplementation(({ children, className, ...props }) => (
          <span className={className} data-testid="typography-text" {...props}>
            {children}
          </span>
        )),
    },
  };
});

// Mock svg icons
jest.mock('../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">Edit</div>,
}));
jest.mock('../../../assets/svg/close-icon.svg', () => ({
  ReactComponent: () => <div data-testid="close-icon-svg">Close</div>,
}));
jest.mock('../../../assets/svg/tick.svg', () => ({
  ReactComponent: () => <div data-testid="tick-icon-svg">Tick</div>,
}));
jest.mock('../../../assets/svg/ic-data-product.svg', () => ({
  ReactComponent: () => <div data-testid="data-product-icon">DP</div>,
}));

// Mock DataProductsSelectListV1 inline to avoid TDZ
jest.mock(
  '../../DataProducts/DataProductsSelectList/DataProductsSelectListV1',
  () => ({
    DataProductsSelectListV1: jest
      .fn()
      .mockImplementation(
        ({
          onCancel,
          onUpdate,
          selectedDataProducts,
          fetchOptions,
          children,
          ...props
        }: {
          onCancel?: () => void;
          onUpdate?: (items: EntityReference[]) => void;
          selectedDataProducts?: EntityReference[];
          fetchOptions?: (searchText: string, after?: number) => void;
          children?: React.ReactNode;
        }) => (
          <div data-testid="data-products-select-list" {...props}>
            <button data-testid="dps-cancel" onClick={() => onCancel?.()}>
              Cancel
            </button>
            <button
              data-testid="dps-submit"
              onClick={() =>
                onUpdate?.([
                  {
                    id: 'dp-2',
                    fullyQualifiedName: 'domain.dp2',
                    name: 'dp2',
                    displayName: 'DP 2',
                    type: 'dataProduct',
                  },
                ])
              }>
              Submit
            </button>
            <button
              data-testid="dps-fetch"
              onClick={() => fetchOptions?.('term', 2)}>
              Fetch
            </button>
            <div data-testid="dps-default-values">
              {Array.isArray(selectedDataProducts)
                ? selectedDataProducts
                    .map((i: EntityReference) => i.fullyQualifiedName)
                    .join(',')
                : ''}
            </div>
            {children}
          </div>
        )
      ),
  })
);

// Mock ToastUtils
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Mock EditIconButton
jest.mock('../IconButtons/EditIconButton', () => ({
  EditIconButton: jest.fn().mockImplementation(({ onClick, ...props }) => (
    <button
      className="edit-icon"
      data-testid="edit-icon-button"
      onClick={onClick}
      {...props}>
      Edit
    </button>
  )),
}));

// Mock Loader
jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => (
    <div className="data-products-loading-container" data-testid="loader">
      Loading...
    </div>
  )),
}));

// Mock APIs
jest.mock('../../../rest/dataProductAPI', () => ({
  fetchDataProductsElasticSearch: jest.fn().mockResolvedValue({ hits: [] }),
}));

jest.mock('../../../rest/tableAPI', () => ({ patchTableDetails: jest.fn() }));
jest.mock('../../../rest/dashboardAPI', () => ({
  patchDashboardDetails: jest.fn(),
}));
jest.mock('../../../rest/topicsAPI', () => ({ patchTopicDetails: jest.fn() }));
jest.mock('../../../rest/pipelineAPI', () => ({
  patchPipelineDetails: jest.fn(),
}));
jest.mock('../../../rest/mlModelAPI', () => ({
  patchMlModelDetails: jest.fn(),
}));
jest.mock('../../../rest/chartsAPI', () => ({ patchChartDetails: jest.fn() }));

// Mock useEntityRules hook
jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn(),
}));

const validUUID = '123e4567-e89b-12d3-a456-426614174000';

const defaultDataProducts: EntityReference[] = [
  {
    id: 'dp-1',
    fullyQualifiedName: 'domain.dp1',
    name: 'dp1',
    displayName: 'DP 1',
    type: 'dataProduct',
  },
];

const defaultProps = {
  dataProducts: defaultDataProducts,
  activeDomains: [
    { id: 'd-1', fullyQualifiedName: 'domain', type: 'domain' },
  ] as EntityReference[],
  showEditButton: true,
  hasPermission: true,
  entityId: validUUID,
  entityType: EntityType.TABLE,
  onDataProductsUpdate: jest.fn(),
};

describe('DataProductsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default entity rules
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: {
        canAddMultipleDataProducts: true,
        maxDataProducts: Infinity,
        requireDomainForDataProduct: false,
      },
      rules: [],
      isLoading: false,
    });
  });

  describe('Rendering', () => {
    it('renders with data products', () => {
      const { container } = render(<DataProductsSection {...defaultProps} />);

      expect(screen.getByTestId('typography-text')).toBeInTheDocument();
      expect(screen.getByText('label.data-product-plural')).toBeInTheDocument();

      // display list
      expect(screen.getByText('DP 1')).toBeInTheDocument();

      const list = container.querySelector(
        '.data-products-list'
      ) as HTMLElement;

      expect(within(list).getByTestId('data-product-icon')).toBeInTheDocument();
    });

    it('renders no-data state when no data products', () => {
      render(<DataProductsSection {...defaultProps} dataProducts={[]} />);

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.data-product-plural"}'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode and shows select list', () => {
      render(<DataProductsSection {...defaultProps} />);

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }

      expect(
        screen.getByTestId('data-products-select-list')
      ).toBeInTheDocument();
      // defaultValue from current data products is passed
      expect(screen.getByTestId('dps-default-values')).toHaveTextContent(
        'domain.dp1'
      );
    });

    it('exits edit mode on cancel', () => {
      render(<DataProductsSection {...defaultProps} />);

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-cancel'));

      expect(
        screen.queryByTestId('data-products-select-list')
      ).not.toBeInTheDocument();
      expect(screen.getByText('DP 1')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('saves successfully and updates', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );
      const onUpdate = jest.fn();

      patchTableDetails.mockResolvedValue({});

      render(
        <DataProductsSection
          {...defaultProps}
          entityType={EntityType.TABLE}
          onDataProductsUpdate={onUpdate}
        />
      );

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
        expect(showSuccessToast).toHaveBeenCalled();
        expect(onUpdate).toHaveBeenCalled();
      });
    });

    it('handles save error', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      const error = new Error('fail') as AxiosError;
      patchTableDetails.mockRejectedValue(error);

      render(
        <DataProductsSection {...defaultProps} entityType={EntityType.TABLE} />
      );

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          error,
          'server.entity-updating-error - {"entity":"label.data-product-plural"}'
        );
      });
    });

    it('does not call API when no changes', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      // Override the select list to return same items
      const { DataProductsSelectListV1 } = jest.requireMock(
        '../../DataProducts/DataProductsSelectList/DataProductsSelectListV1'
      );
      DataProductsSelectListV1.mockImplementationOnce(
        ({
          onUpdate,
          ...props
        }: {
          onUpdate?: (products: unknown[]) => void;
        }) => (
          <div data-testid="data-products-select-list" {...props}>
            <button
              data-testid="dps-submit"
              onClick={() =>
                onUpdate?.([
                  {
                    id: 'dp-1',
                    fullyQualifiedName: 'domain.dp1',
                    name: 'dp1',
                    displayName: 'DP 1',
                    type: 'dataProduct',
                  },
                ])
              }>
              Submit
            </button>
          </div>
        )
      );

      render(
        <DataProductsSection {...defaultProps} entityType={EntityType.TABLE} />
      );

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(patchTableDetails).not.toHaveBeenCalled();
      });
    });

    it('shows loading spinner while saving', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      let resolvePromise: (() => void) | undefined;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      patchTableDetails.mockReturnValue(promise);

      render(
        <DataProductsSection {...defaultProps} entityType={EntityType.TABLE} />
      );

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }

      // Wait for edit mode to be active
      await waitFor(() => {
        expect(screen.getByTestId('dps-submit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('dps-submit'));

      // Wait for loading state to appear
      await waitFor(
        () => {
          expect(
            document.querySelector('.data-products-loading-container')
          ).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Resolve the promise to finish the test
      if (resolvePromise) {
        resolvePromise();
      }
    });
  });

  describe('Entity Type Handling', () => {
    it('uses TABLE patch API for TABLE entity', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      patchTableDetails.mockResolvedValue({});

      render(
        <DataProductsSection {...defaultProps} entityType={EntityType.TABLE} />
      );

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });

    it('uses DASHBOARD patch API for DASHBOARD entity', async () => {
      const { patchDashboardDetails } = jest.requireMock(
        '../../../rest/dashboardAPI'
      );
      patchDashboardDetails.mockResolvedValue({});

      render(
        <DataProductsSection
          {...defaultProps}
          entityType={EntityType.DASHBOARD}
        />
      );

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(patchDashboardDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });
  });

  describe('Validation', () => {
    it('shows error when entityId missing', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      render(<DataProductsSection {...defaultProps} entityId={undefined} />);

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.entity-id-required'
        );
      });
    });
  });

  describe('Fetch Options', () => {
    it('calls fetch API with search and active domains', async () => {
      const { fetchDataProductsElasticSearch } = jest.requireMock(
        '../../../rest/dataProductAPI'
      );

      render(<DataProductsSection {...defaultProps} />);

      const editIcon = screen.getByTestId('edit-data-products');
      if (editIcon) {
        fireEvent.click(editIcon);
      }
      fireEvent.click(screen.getByTestId('dps-fetch'));

      await waitFor(() => {
        expect(fetchDataProductsElasticSearch).toHaveBeenCalledWith(
          'term',
          ['domain'],
          2
        );
      });
    });
  });
});
