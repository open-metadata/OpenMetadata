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
import { AxiosError } from 'axios';
import { EntityType } from '../../../enums/entity.enum';
import OwnersSection from './OwnersSection';

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

// Mock antd components
jest.mock('antd', () => ({
  Typography: {
    Text: jest.fn().mockImplementation(({ children, className, ...props }) => (
      <span className={className} data-testid="typography-text" {...props}>
        {children}
      </span>
    )),
  },
}));

// Mock SVG components
jest.mock('../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon">EditIcon</div>,
}));

// Mock OwnerLabel
jest.mock('../OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(() => <div data-testid="owner-label">OwnerLabel</div>),
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
    <div className="owners-loading-container" data-testid="loader">
      Loading...
    </div>
  )),
}));

// Mock UserTeamSelectableList
const userTeamSelectableListMock = jest
  .fn()
  .mockImplementation(({ children, onUpdate, owner }: any) => (
    <div data-testid="user-selectable-list">
      {children}
      <button
        data-testid="owner-selector-trigger"
        onClick={() =>
          onUpdate?.([
            { id: '2', name: 'bob', displayName: 'Bob', type: 'user' },
            { id: '3', name: 'carol', displayName: 'Carol', type: 'team' },
          ])
        }>
        Select Owners
      </button>
      <div data-testid="selected-users-debug">
        {(owner || []).map((u: any) => (
          <span key={u.id}>{u.displayName || u.name}</span>
        ))}
      </div>
    </div>
  ));

jest.mock('../UserTeamSelectableList/UserTeamSelectableList.component', () => ({
  UserTeamSelectableList: (props: any) => userTeamSelectableListMock(props),
}));

// Mock ToastUtils
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Mock patch API functions
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
jest.mock('../../../rest/apiCollectionsAPI', () => ({
  patchApiCollection: jest.fn(),
}));
jest.mock('../../../rest/apiEndpointsAPI', () => ({
  patchApiEndPoint: jest.fn(),
}));
jest.mock('../../../rest/databaseAPI', () => ({
  patchDatabaseDetails: jest.fn(),
  patchDatabaseSchemaDetails: jest.fn(),
}));
jest.mock('../../../rest/storedProceduresAPI', () => ({
  patchStoredProceduresDetails: jest.fn(),
}));
jest.mock('../../../rest/storageAPI', () => ({
  patchContainerDetails: jest.fn(),
}));
jest.mock('../../../rest/dataModelsAPI', () => ({
  patchDataModelDetails: jest.fn(),
}));
jest.mock('../../../rest/SearchIndexAPI', () => ({
  patchSearchIndexDetails: jest.fn(),
}));
jest.mock('../../../rest/dataProductAPI', () => ({
  patchDataProduct: jest.fn(),
}));

const validUUID = '123e4567-e89b-12d3-a456-426614174000';

const defaultOwners = [{ id: '1', name: 'alice', displayName: 'Alice' }];

const defaultProps = {
  owners: defaultOwners as any,
  showEditButton: true,
  hasPermission: true,
  entityId: validUUID,
  entityType: EntityType.TABLE,
  onOwnerUpdate: jest.fn(),
};

describe('OwnersSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<OwnersSection {...(defaultProps as any)} />);

      expect(screen.getByTestId('typography-text')).toBeInTheDocument();
      expect(screen.getByText('label.owner-plural')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(
        <OwnersSection {...(defaultProps as any)} />
      );

      expect(container.querySelector('.owners-section')).toBeInTheDocument();
      expect(container.querySelector('.owners-header')).toBeInTheDocument();
      expect(container.querySelector('.owners-content')).toBeInTheDocument();
    });
  });

  describe('No Owners State', () => {
    it('should render no data found message when no owners', () => {
      render(<OwnersSection {...(defaultProps as any)} owners={[]} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should enter edit mode when no owners', () => {
      const { container } = render(
        <OwnersSection {...(defaultProps as any)} owners={[]} />
      );

      // Check if edit icon exists
      const editIcon = container.querySelector('.edit-icon');

      expect(editIcon).toBeInTheDocument();

      // Enter edit mode
      if (editIcon) {
        fireEvent.click(editIcon);
      }

      // Verify edit mode is active with selector displayed
      expect(screen.getByTestId('user-selectable-list')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode and show selected owners', () => {
      const { container } = render(
        <OwnersSection {...(defaultProps as any)} />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      expect(screen.getByTestId('user-selectable-list')).toBeInTheDocument();
      // Initial selected owners are shown in edit display (use selector to avoid duplicates)
      expect(
        screen.getByText('Alice', { selector: '.owner-name' })
      ).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should save owners successfully', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );
      const onOwnerUpdate = jest.fn();

      patchTableDetails.mockResolvedValue({});

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
          onOwnerUpdate={onOwnerUpdate}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Trigger selection which immediately saves
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
        expect(showSuccessToast).toHaveBeenCalled();
        expect(onOwnerUpdate).toHaveBeenCalled();
      });
    });

    it('should handle save error', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      const mockError = new Error('Save failed') as AxiosError;
      patchTableDetails.mockRejectedValue(mockError);

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Trigger selection which immediately saves
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          mockError,
          'server.entity-updating-error - {"entity":"label.owner-plural"}'
        );
      });
    });

    it('should not save when no changes are made', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      // Simulate selecting the same owners list (no changes) - set up mock before rendering
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: any) => (
          <div data-testid="user-selectable-list">
            {children}
            <button
              data-testid="owner-selector-trigger"
              onClick={() => onUpdate?.(defaultOwners)}>
              Select Owners (No Change)
            </button>
          </div>
        )
      );

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchTableDetails).not.toHaveBeenCalled();
      });
    });

    it('should show loading state during save', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      // Mock a delayed response
      patchTableDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Mock UserTeamSelectableList to trigger save with different owners
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: any) => (
          <div data-testid="user-selectable-list">
            {children}
            <button
              data-testid="owner-selector-trigger"
              onClick={() =>
                onUpdate?.([
                  {
                    id: 'u2',
                    name: 'bob',
                    displayName: 'Bob',
                    type: 'user',
                  },
                ])
              }>
              Select Owner
            </button>
          </div>
        )
      );

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(
        () => {
          expect(
            document.querySelector('.owners-loading-container')
          ).toBeInTheDocument();
        },
        { timeout: 50 }
      );
    });
  });

  describe('Entity Type Handling', () => {
    it('should use correct patch API for TABLE entity', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      patchTableDetails.mockResolvedValue({});

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });

    it('should use correct patch API for DASHBOARD entity', async () => {
      const { patchDashboardDetails } = jest.requireMock(
        '../../../rest/dashboardAPI'
      );

      patchDashboardDetails.mockResolvedValue({});

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.DASHBOARD}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchDashboardDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });
  });

  describe('Entity ID Validation', () => {
    it('should show error when entityId is missing', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityId={undefined}
          entityType={EntityType.TABLE}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.entity-id-required'
        );
      });
    });
  });

  describe('Team Selection Functionality', () => {
    it('should handle team-only owners', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );
      const onOwnerUpdate = jest.fn();

      patchTableDetails.mockResolvedValue({});

      const teamOwners = [
        {
          id: 't1',
          name: 'engineering',
          displayName: 'Engineering',
          type: 'team',
        },
      ];

      // Mock selecting teams - set up before rendering
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: any) => (
          <div data-testid="user-selectable-list">
            {children}
            <button
              data-testid="owner-selector-trigger"
              onClick={() =>
                onUpdate?.([
                  {
                    id: 't2',
                    name: 'data-team',
                    displayName: 'Data Team',
                    type: 'team',
                  },
                ])
              }>
              Select Team
            </button>
          </div>
        )
      );

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
          owners={teamOwners}
          onOwnerUpdate={onOwnerUpdate}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalled();
        expect(showSuccessToast).toHaveBeenCalled();
        expect(onOwnerUpdate).toHaveBeenCalledWith([
          {
            id: 't2',
            name: 'data-team',
            displayName: 'Data Team',
            type: 'team',
          },
        ]);
      });
    });

    it('should handle mixed user and team owners', async () => {
      const mixedOwners = [
        {
          id: 'u1',
          name: 'alice',
          displayName: 'Alice',
          type: 'user',
        },
        {
          id: 't1',
          name: 'engineering',
          displayName: 'Engineering',
          type: 'team',
        },
      ];

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
          owners={mixedOwners}
        />
      );

      expect(screen.getByTestId('owner-label')).toBeInTheDocument();

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Verify mixed owners display in edit mode
      expect(
        screen.getByText('Alice', { selector: '.owner-name' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Engineering', { selector: '.owner-name' })
      ).toBeInTheDocument();
    });

    it('should render team owners with displayName or name', () => {
      const teamOwners = [
        {
          id: 't1',
          name: 'engineering',
          displayName: 'Engineering Team',
          type: 'team',
        },
        { id: 't2', name: 'data-team', type: 'team' }, // No displayName
      ];

      const { container } = render(
        <OwnersSection {...(defaultProps as any)} owners={teamOwners} />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      expect(
        screen.getByText('Engineering Team', { selector: '.owner-name' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('data-team', { selector: '.owner-name' })
      ).toBeInTheDocument();
    });

    it('should pass correct props to UserTeamSelectableList', () => {
      const { container } = render(
        <OwnersSection {...(defaultProps as any)} hasPermission />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      expect(userTeamSelectableListMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPermission: true,
          multiple: { user: true, team: true },
          owner: defaultOwners,
          popoverProps: expect.objectContaining({ placement: 'bottomLeft' }),
        })
      );
    });

    it('should handle undefined owners in onUpdate callback', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const onOwnerUpdate = jest.fn();

      patchTableDetails.mockResolvedValue({});

      // Mock selecting with undefined (should default to empty array) - set up before rendering
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: any) => (
          <div data-testid="user-selectable-list">
            {children}
            <button
              data-testid="owner-selector-trigger"
              onClick={() => onUpdate?.(undefined)}>
              Clear Owners
            </button>
          </div>
        )
      );

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.TABLE}
          onOwnerUpdate={onOwnerUpdate}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(onOwnerUpdate).toHaveBeenCalledWith([]);
      });
    });
  });

  describe('Permission Handling', () => {
    it('should not show edit button when hasPermission is false', () => {
      const { container } = render(
        <OwnersSection {...(defaultProps as any)} hasPermission={false} />
      );

      expect(container.querySelector('.edit-icon')).not.toBeInTheDocument();
    });

    it('should not show edit button when showEditButton is false', () => {
      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          hasPermission
          showEditButton={false}
        />
      );

      expect(container.querySelector('.edit-icon')).not.toBeInTheDocument();
    });

    it('should show edit button only when both hasPermission and showEditButton are true', () => {
      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          hasPermission
          showEditButton
        />
      );

      expect(container.querySelector('.edit-icon')).toBeInTheDocument();
    });
  });

  describe('Additional Entity Types', () => {
    it('should use correct patch API for MLMODEL entity', async () => {
      const { patchMlModelDetails } = jest.requireMock(
        '../../../rest/mlModelAPI'
      );

      patchMlModelDetails.mockResolvedValue({});

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.MLMODEL}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchMlModelDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });

    it('should use correct patch API for DATA_PRODUCT entity', async () => {
      const { patchDataProduct } = jest.requireMock(
        '../../../rest/dataProductAPI'
      );

      patchDataProduct.mockResolvedValue({});

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.DATA_PRODUCT}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchDataProduct).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });

    it('should use correct patch API for CONTAINER entity', async () => {
      const { patchContainerDetails } = jest.requireMock(
        '../../../rest/storageAPI'
      );

      patchContainerDetails.mockResolvedValue({});

      const { container } = render(
        <OwnersSection
          {...(defaultProps as any)}
          entityType={EntityType.CONTAINER}
        />
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(patchContainerDetails).toHaveBeenCalledWith(
          validUUID,
          expect.any(Array)
        );
      });
    });
  });
});
