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
import DataProductsSection from './DataProductsSection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: any) => {
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
jest.mock('../../../assets/svg/edit.svg', () => ({
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

// Mock DataProductsSelectList inline to avoid TDZ
jest.mock(
  '../../DataProducts/DataProductsSelectList/DataProductsSelectList',
  () => {
    return jest
      .fn()
      .mockImplementation(
        ({ onCancel, onSubmit, defaultValue, fetchOptions, ...props }: any) => (
          <div data-testid="data-products-select-list" {...props}>
            <button data-testid="dps-cancel" onClick={() => onCancel?.()}>
              Cancel
            </button>
            <button
              data-testid="dps-submit"
              onClick={() =>
                onSubmit?.([
                  {
                    id: 'dp-2',
                    fullyQualifiedName: 'domain.dp2',
                    name: 'dp2',
                    displayName: 'DP 2',
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
              {Array.isArray(defaultValue) ? defaultValue.join(',') : ''}
            </div>
          </div>
        )
      );
  }
);

// Mock ToastUtils
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
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

const validUUID = '123e4567-e89b-12d3-a456-426614174000';

const defaultDataProducts = [
  {
    id: 'dp-1',
    fullyQualifiedName: 'domain.dp1',
    name: 'dp1',
    displayName: 'DP 1',
    type: 'dataProduct',
  },
];

const defaultProps = {
  dataProducts: defaultDataProducts as any,
  activeDomains: [{ id: 'd-1', fullyQualifiedName: 'domain' }] as any,
  showEditButton: true,
  hasPermission: true,
  entityId: validUUID,
  entityType: EntityType.TABLE,
  onDataProductsUpdate: jest.fn(),
};

const clickHeaderEdit = () => {
  const clickable = document.querySelector(
    '.data-products-header .cursor-pointer'
  ) as HTMLElement | null;
  if (!clickable) {
    throw new Error('Edit clickable not found');
  }
  fireEvent.click(clickable);
};

const clickHeaderCancel = () => {
  const clickable =
    (document.querySelector(
      '.edit-actions .cursor-pointer'
    ) as HTMLElement | null) ||
    (document.querySelector(
      '.data-products-header .cursor-pointer'
    ) as HTMLElement | null);
  if (!clickable) {
    throw new Error('Cancel clickable not found');
  }
  fireEvent.click(clickable);
};

describe('DataProductsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with data products', () => {
      const { container } = render(
        <DataProductsSection {...(defaultProps as any)} />
      );

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
      render(
        <DataProductsSection {...(defaultProps as any)} dataProducts={[]} />
      );

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode and shows select list', () => {
      render(<DataProductsSection {...(defaultProps as any)} />);

      clickHeaderEdit();

      expect(
        screen.getByTestId('data-products-select-list')
      ).toBeInTheDocument();
      // defaultValue from current data products is passed
      expect(screen.getByTestId('dps-default-values')).toHaveTextContent(
        'domain.dp1'
      );
    });

    it('exits edit mode on cancel', () => {
      render(<DataProductsSection {...(defaultProps as any)} />);

      clickHeaderEdit();
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
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
          onDataProductsUpdate={onUpdate}
        />
      );

      clickHeaderEdit();
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
        <DataProductsSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      clickHeaderEdit();
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
      const SelectMock = jest.requireMock(
        '../../DataProducts/DataProductsSelectList/DataProductsSelectList'
      );
      SelectMock.mockImplementationOnce(({ onSubmit, ...props }: any) => (
        <div data-testid="data-products-select-list" {...props}>
          <button
            data-testid="dps-submit"
            onClick={() =>
              onSubmit?.([
                {
                  id: 'dp-1',
                  fullyQualifiedName: 'domain.dp1',
                  name: 'dp1',
                  displayName: 'DP 1',
                },
              ])
            }>
            Submit
          </button>
        </div>
      ));

      render(
        <DataProductsSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(patchTableDetails).not.toHaveBeenCalled();
      });
    });

    it('shows loading spinner while saving', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      patchTableDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <DataProductsSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(
          document.querySelector('.data-products-loading-container')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Entity Type Handling', () => {
    it('uses TABLE patch API for TABLE entity', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      patchTableDetails.mockResolvedValue({});

      render(
        <DataProductsSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );
      clickHeaderEdit();
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
          {...(defaultProps as any)}
          entityType={EntityType.DASHBOARD}
        />
      );
      clickHeaderEdit();
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

      render(
        <DataProductsSection {...(defaultProps as any)} entityId={undefined} />
      );
      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.entity-id-required'
        );
      });
    });

    it('shows error when entityId invalid', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      render(
        <DataProductsSection {...(defaultProps as any)} entityId="invalid-id" />
      );
      clickHeaderEdit();
      fireEvent.click(screen.getByTestId('dps-submit'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.invalid-entity-id'
        );
      });
    });
  });

  describe('Fetch Options', () => {
    it('calls fetch API with search and active domains', async () => {
      const { fetchDataProductsElasticSearch } = jest.requireMock(
        '../../../rest/dataProductAPI'
      );

      render(<DataProductsSection {...(defaultProps as any)} />);

      clickHeaderEdit();
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
