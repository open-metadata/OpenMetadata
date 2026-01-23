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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { DomainSelectableListProps } from '../DomainSelectableList/DomainSelectableList.interface';
import DomainsSection from './DomainsSection';

// i18n mock
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
jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => (
    <div className="domains-loading-container" data-testid="loader">
      Loading...
    </div>
  )),
}));
// Partial antd mock for Typography.Text
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');

  return {
    ...actual,
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

// SVG icon mocks
jest.mock('../../../assets/svg/edit.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">Edit</div>,
}));
jest.mock('../../../assets/svg/close-icon.svg', () => ({
  ReactComponent: () => <div data-testid="close-icon-svg">Close</div>,
}));

// Toast utils
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Assets utils
const mockGetEntityAPI = jest.fn();
const mockPatchAPI = jest.fn();
jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getEntityAPIfromSource: jest.fn().mockImplementation(() => mockGetEntityAPI),
  getAPIfromSource: jest.fn().mockImplementation(() => mockPatchAPI),
}));

// DomainSelectableList mock: exposes onUpdate and renders children with edit button
const domainSelectableListMock = jest
  .fn()
  .mockImplementation(({ children, onUpdate }: DomainSelectableListProps) => (
    <div data-testid="domain-selectable-list">
      {/* Render the edit button with the className passed from parent */}
      <button className="edit-icon" data-testid="edit-icon" type="button">
        <div data-testid="edit-icon-svg">Edit</div>
      </button>
      {children}
      <button
        data-testid="domain-select-submit"
        onClick={() =>
          onUpdate([
            { id: 'd1', name: 'd1', displayName: 'Domain 1' },
            { id: 'd2', name: 'd2', displayName: 'Domain 2' },
          ] as EntityReference[])
        }>
        Submit Domains
      </button>
      <button data-testid="domain-select-clear" onClick={() => onUpdate([])}>
        Clear Domains
      </button>
    </div>
  ));
jest.mock('../DomainSelectableList/DomainSelectableList.component', () => ({
  __esModule: true,
  default: (props: DomainSelectableListProps) =>
    domainSelectableListMock(props),
}));

// Mock getDomainIcon utility
jest.mock('../../../utils/DomainUtils', () => ({
  getDomainIcon: jest.fn().mockReturnValue(<div data-testid="domain-icon" />),
}));

// Mock getEntityName utility
jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity.displayName || entity.name),
}));

// Mock useEntityRules hook
jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn(),
}));

const validUUID = '123e4567-e89b-12d3-a456-426614174000';
const defaultProps = {
  entityType: EntityType.TABLE,
  entityFqn: 'service.table1',
  entityId: validUUID,
  showEditButton: true,
  hasPermission: true,
  onDomainUpdate: jest.fn(),
};

describe('DomainsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default entity rules
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: {
        canAddMultipleDomains: true,
        maxDomains: Infinity,
      },
      rules: [],
      isLoading: false,
    });
  });

  describe('Rendering', () => {
    it('renders header, title and no-data when empty', () => {
      const { container } = render(<DomainsSection {...defaultProps} />);

      expect(screen.getByTestId('typography-text')).toBeInTheDocument();
      expect(screen.getByText('label.domain-plural')).toBeInTheDocument();
      expect(container.querySelector('.domains-section')).toBeInTheDocument();
      expect(container.querySelector('.domains-header')).toBeInTheDocument();
      expect(container.querySelector('.domains-content')).toBeInTheDocument();
      // Initially no domains provided in props, component shows no-data when not editing
      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.domain-plural"}'
        )
      ).toBeInTheDocument();
    });

    it('renders existing domains via custom domain cards when provided', () => {
      const { container } = render(
        <DomainsSection
          {...defaultProps}
          domains={[
            {
              id: 'd1',
              name: 'd1',
              displayName: 'Domain 1',
              type: EntityType.DOMAIN,
            },
          ]}
        />
      );

      expect(container.querySelector('.domains-display')).toBeInTheDocument();
      expect(container.querySelector('.domain-item')).toBeInTheDocument();
      expect(screen.getByText('Domain 1')).toBeInTheDocument();
    });
  });

  describe('Edit Functionality', () => {
    it('renders DomainSelectableList when hasPermission is true', () => {
      render(<DomainsSection {...defaultProps} />);

      // The DomainSelectableList should be rendered (with edit button)
      expect(screen.getByTestId('domain-selectable-list')).toBeInTheDocument();
      expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    });

    it('shows domain list with edit button when domains are present', () => {
      render(
        <DomainsSection
          {...defaultProps}
          domains={[
            {
              id: 'd1',
              name: 'd1',
              displayName: 'Domain 1',
              type: EntityType.DOMAIN,
            },
          ]}
        />
      );

      // Domain should be displayed
      expect(screen.getByText('Domain 1')).toBeInTheDocument();
      // Edit button should be present
      expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    });

    it('does not render edit button when hasPermission is false', () => {
      render(<DomainsSection {...defaultProps} hasPermission={false} />);

      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('saves successfully and updates via APIs', async () => {
      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );
      const onUpdate = jest.fn();

      // Entity details has different domains than selection to ensure patch length > 0
      mockGetEntityAPI.mockResolvedValue({ domains: [] });
      mockPatchAPI.mockResolvedValue({
        domains: [
          { id: 'd1', name: 'd1', displayName: 'Domain 1' },
          { id: 'd2', name: 'd2', displayName: 'Domain 2' },
        ],
      });

      render(<DomainsSection {...defaultProps} onDomainUpdate={onUpdate} />);

      // No need to click edit - directly submit from the dropdown
      fireEvent.click(screen.getByTestId('domain-select-submit'));

      await waitFor(() => {
        expect(mockGetEntityAPI).toHaveBeenCalledWith('service.table1', {
          fields: 'domains',
        });
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
        expect(showSuccessToast).toHaveBeenCalled();
        expect(onUpdate).toHaveBeenCalled();
      });
    });

    it('handles save error and shows error toast', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      mockGetEntityAPI.mockResolvedValue({ domains: [] });
      const error = new Error('failed');
      mockPatchAPI.mockRejectedValue(error);

      render(<DomainsSection {...defaultProps} />);

      // No need to click edit - directly submit from the dropdown
      fireEvent.click(screen.getByTestId('domain-select-submit'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });

    it('does not call patch API when no changes (empty -> empty)', async () => {
      mockGetEntityAPI.mockResolvedValue({ domains: [] });
      mockPatchAPI.mockResolvedValue({ domains: [] });

      render(<DomainsSection {...defaultProps} />);

      // No need to click edit - directly clear from the dropdown
      fireEvent.click(screen.getByTestId('domain-select-clear'));

      await waitFor(() => {
        expect(mockPatchAPI).not.toHaveBeenCalled();
      });
    });

    it('shows loading spinner during save', async () => {
      mockGetEntityAPI.mockResolvedValue({ domains: [] });
      mockPatchAPI.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ domains: [] }), 100)
          )
      );

      render(<DomainsSection {...defaultProps} />);

      // No need to click edit - directly submit from the dropdown
      fireEvent.click(screen.getByTestId('domain-select-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('loader')).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('shows error when required entity details are missing', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      render(<DomainsSection {...defaultProps} entityId={undefined} />);

      // No need to click edit - directly submit from the dropdown
      fireEvent.click(screen.getByTestId('domain-select-submit'));

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.entity-details-required'
        );
      });
    });
  });

  describe('CSS and Structure', () => {
    it('has expected structural classes', () => {
      const { container } = render(<DomainsSection {...defaultProps} />);

      expect(container.querySelector('.domains-section')).toBeInTheDocument();
      expect(container.querySelector('.domains-header')).toBeInTheDocument();
      expect(container.querySelector('.domains-content')).toBeInTheDocument();
    });
  });
});
