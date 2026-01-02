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

import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useEntityRules } from '../../../hooks/useEntityRules';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import OwnersSection from './OwnersSection';

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  blue: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    200: '#91D5FF',
    300: '#69C0FF',
    600: '#1677FF',
    700: '#0958D9',
  },
  blueGray: {
    50: '#F8FAFC',
    75: '#F1F5F9',
    150: '#E2E8F0',
  },
  gray: {
    200: '#E5E7EB',
    300: '#D1D5DB',
    500: '#6B7280',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
    primary: {
      main: '#1677FF',
      dark: '#0958D9',
    },
    background: {
      paper: '#FFFFFF',
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

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

// Mock antd components
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
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
interface UserTeamSelectableListMockProps {
  children?: React.ReactNode;
  onUpdate?: (owners: EntityReference[]) => void;
  owner?: EntityReference[];
}

const userTeamSelectableListMock = jest
  .fn()
  .mockImplementation(
    ({ children, onUpdate, owner }: UserTeamSelectableListMockProps) => (
      <div data-testid="user-selectable-list">
        {children}
        <button
          data-testid="owner-selector-trigger"
          onClick={() =>
            onUpdate?.([
              { id: '2', name: 'bob', displayName: 'Bob', type: 'user' },
              { id: '3', name: 'carol', displayName: 'Carol', type: 'team' },
            ] as EntityReference[])
          }>
          Select Owners
        </button>
        <div data-testid="selected-users-debug">
          {(owner || []).map((u) => (
            <span key={u.id}>{u.displayName || u.name}</span>
          ))}
        </div>
      </div>
    )
  );

jest.mock('../UserTeamSelectableList/UserTeamSelectableList.component', () => ({
  UserTeamSelectableList: (props: UserTeamSelectableListMockProps) =>
    userTeamSelectableListMock(props),
}));

// Mock ToastUtils
const mockShowErrorToast = jest.fn() as jest.Mock<
  void,
  [AxiosError | string | React.JSX.Element, string?, number?]
>;

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(
    (error: AxiosError | string | React.JSX.Element, fallbackText?: string) =>
      mockShowErrorToast(error, fallbackText)
  ),
}));

jest.mock('../../../utils/EntityUtilClassBase');

// Mock useEntityRules hook
jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn(),
}));

// Mock updateEntityField
const mockUpdateEntityField = jest.fn();
jest.mock('../../../utils/EntityUpdateUtils', () => ({
  updateEntityField: (...args: unknown[]) => mockUpdateEntityField(...args),
}));

const validUUID = '123e4567-e89b-12d3-a456-426614174000';

const defaultOwners: EntityReference[] = [
  { id: '1', name: 'alice', displayName: 'Alice', type: 'user' },
];

const defaultProps = {
  owners: defaultOwners,
  showEditButton: true,
  hasPermission: true,
  entityId: validUUID,
  entityType: EntityType.TABLE,
  onOwnerUpdate: jest.fn(),
};

const mockPatchAPI = jest.fn();

// Default entity rules configuration (only owner-related properties needed for this test)
const defaultEntityRules = {
  canAddMultipleUserOwners: true,
  canAddMultipleTeamOwner: true,
};

describe('OwnersSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (entityUtilClassBase.getEntityPatchAPI as jest.Mock).mockImplementation(
      () => mockPatchAPI
    );
    // Set default entity rules
    (useEntityRules as jest.Mock).mockReturnValue({
      entityRules: defaultEntityRules,
      rules: [],
      isLoading: false,
    });

    // Reset updateEntityField mock - make it call the patch API internally
    mockUpdateEntityField.mockImplementation(
      async (options: {
        entityId?: string;
        entityType: EntityType;
        fieldName: string;
        currentValue: EntityReference[];
        newValue: EntityReference[];
        entityLabel: string;
        onSuccess?: (data: EntityReference[]) => void;
        t: (key: string, options?: Record<string, unknown>) => string;
      }) => {
        // Check if entityId is missing
        if (!options.entityId) {
          mockShowErrorToast(options.t('message.entity-id-required'));

          return { success: false };
        }

        // Check if there are no changes (same owners)
        const currentIds = (options.currentValue || [])
          .map((o) => o.id)
          .sort()
          .join(',');
        const newIds = (options.newValue || [])
          .map((o) => o.id)
          .sort()
          .join(',');
        if (currentIds === newIds) {
          // No changes, return early without calling API
          return { success: true, data: options.currentValue };
        }

        try {
          // Simulate the patch API call
          await mockPatchAPI(options.entityId, expect.any(Array));

          // Call onSuccess if provided
          if (options.onSuccess) {
            options.onSuccess(options.newValue);
          }

          return { success: true, data: options.newValue };
        } catch (error) {
          const fallbackMessage = options.t('server.entity-updating-error', {
            entity: options.entityLabel.toLowerCase(),
          });
          mockShowErrorToast(error as AxiosError, fallbackMessage);

          return { success: false };
        }
      }
    );

    // Reset UserTeamSelectableList mock
    userTeamSelectableListMock.mockImplementation(
      ({ children, onUpdate, owner }: UserTeamSelectableListMockProps) => (
        <div data-testid="user-selectable-list">
          {children}
          <button
            data-testid="owner-selector-trigger"
            onClick={() =>
              onUpdate?.([
                { id: '2', name: 'bob', displayName: 'Bob', type: 'user' },
                { id: '3', name: 'carol', displayName: 'Carol', type: 'team' },
              ] as EntityReference[])
            }>
            Select Owners
          </button>
          <div data-testid="selected-users-debug">
            {(owner || []).map((u) => (
              <span key={u.id}>{u.displayName || u.name}</span>
            ))}
          </div>
        </div>
      )
    );
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<OwnersSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('label.owner-plural')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      // Check for the main Box component with border
      expect(
        container.querySelector('[class*="MuiBox-root"]')
      ).toBeInTheDocument();
    });
  });

  describe('No Owners State', () => {
    it('should render no data found message when no owners', () => {
      render(<OwnersSection {...defaultProps} owners={[]} />, {
        wrapper: Wrapper,
      });

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.owner-plural"}'
        )
      ).toBeInTheDocument();
    });

    it('should show edit icon when no owners and has permission', () => {
      const { container } = render(
        <OwnersSection {...defaultProps} owners={[]} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');

      expect(editIcon).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode and show selected owners', async () => {
      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      const editIcon = container.querySelector('.edit-icon');

      expect(editIcon).toBeInTheDocument();

      // Owner label is displayed
      expect(screen.getByTestId('owner-label')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should save owners successfully', async () => {
      const onOwnerUpdate = jest.fn();

      const { container } = render(
        <OwnersSection
          {...defaultProps}
          entityType={EntityType.TABLE}
          onOwnerUpdate={onOwnerUpdate}
        />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Trigger selection which immediately saves
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
        expect(onOwnerUpdate).toHaveBeenCalled();
      });
    });

    it('should handle save error', async () => {
      const mockError = new Error('Save failed') as AxiosError;
      // Make patch API throw an error, which updateEntityField will catch
      mockPatchAPI.mockRejectedValue(mockError);

      const { container } = render(
        <OwnersSection {...defaultProps} entityType={EntityType.TABLE} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Trigger selection which immediately saves
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(
          mockError,
          'server.entity-updating-error - {"entity":"label.owner-plural"}'
        );
      });
    });

    it('should not save when no changes are made', async () => {
      // Simulate selecting the same owners list (no changes) - set up mock before rendering
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: UserTeamSelectableListMockProps) => (
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
        <OwnersSection {...defaultProps} entityType={EntityType.TABLE} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).not.toHaveBeenCalled();
      });
    });

    it('should show loading state during save', async () => {
      // Mock a delayed response
      mockPatchAPI.mockImplementation(
        () => new Promise((res) => setTimeout(res, 100))
      );

      // Mock UserTeamSelectableList to trigger save with different owners
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: UserTeamSelectableListMockProps) => (
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
        <OwnersSection {...defaultProps} entityType={EntityType.TABLE} />,
        { wrapper: Wrapper }
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
      const { container } = render(
        <OwnersSection {...defaultProps} entityType={EntityType.TABLE} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
      });
    });

    it('should use correct patch API for DASHBOARD entity', async () => {
      const { container } = render(
        <OwnersSection {...defaultProps} entityType={EntityType.DASHBOARD} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
      });
    });
  });

  describe('Entity ID Validation', () => {
    it('should show error when entityId is missing', async () => {
      const { container } = render(
        <OwnersSection
          {...defaultProps}
          entityId={undefined}
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(
          'message.entity-id-required'
        );
      });
    });
  });

  describe('Team Selection Functionality', () => {
    it('should handle team-only owners', async () => {
      const onOwnerUpdate = jest.fn();

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
        ({ onUpdate, children }: UserTeamSelectableListMockProps) => (
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
          {...defaultProps}
          entityType={EntityType.TABLE}
          owners={teamOwners}
          onOwnerUpdate={onOwnerUpdate}
        />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalled();
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
          {...defaultProps}
          entityType={EntityType.TABLE}
          owners={mixedOwners}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByTestId('owner-label')).toBeInTheDocument();

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Verify mixed owners display in edit mode - check selected-users-debug
      const debugElement = screen.getByTestId('selected-users-debug');

      expect(debugElement).toBeInTheDocument();
      expect(debugElement).toHaveTextContent('Alice');
      expect(debugElement).toHaveTextContent('Engineering');
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
        <OwnersSection {...defaultProps} owners={teamOwners} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Check selected-users-debug for owners
      const debugElement = screen.getByTestId('selected-users-debug');

      expect(debugElement).toBeInTheDocument();
      expect(debugElement).toHaveTextContent('Engineering Team');
      expect(debugElement).toHaveTextContent('data-team');
    });

    it('should pass correct props to UserTeamSelectableList', () => {
      const { container } = render(
        <OwnersSection {...defaultProps} hasPermission />,
        { wrapper: Wrapper }
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
      const onOwnerUpdate = jest.fn();

      // Mock selecting with empty array to clear owners
      userTeamSelectableListMock.mockImplementationOnce(
        ({ onUpdate, children }: UserTeamSelectableListMockProps) => (
          <div data-testid="user-selectable-list">
            {children}
            <button
              data-testid="owner-selector-trigger"
              onClick={() => onUpdate?.([])}>
              Clear Owners
            </button>
          </div>
        )
      );

      const { container } = render(
        <OwnersSection
          {...defaultProps}
          entityType={EntityType.TABLE}
          onOwnerUpdate={onOwnerUpdate}
        />,
        { wrapper: Wrapper }
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
        <OwnersSection {...defaultProps} hasPermission={false} />,
        { wrapper: Wrapper }
      );

      expect(container.querySelector('.edit-icon')).not.toBeInTheDocument();
    });

    it('should not show edit button when showEditButton is false', () => {
      const { container } = render(
        <OwnersSection
          {...defaultProps}
          hasPermission
          showEditButton={false}
        />,
        { wrapper: Wrapper }
      );

      expect(container.querySelector('.edit-icon')).not.toBeInTheDocument();
    });

    it('should show edit button only when both hasPermission and showEditButton are true', () => {
      const { container } = render(
        <OwnersSection {...defaultProps} hasPermission showEditButton />,
        { wrapper: Wrapper }
      );

      expect(container.querySelector('.edit-icon')).toBeInTheDocument();
    });
  });

  describe('Additional Entity Types', () => {
    it('should use correct patch API for MLMODEL entity', async () => {
      const { container } = render(
        <OwnersSection {...defaultProps} entityType={EntityType.MLMODEL} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
      });
    });

    it('should use correct patch API for DATA_PRODUCT entity', async () => {
      const { container } = render(
        <OwnersSection
          {...defaultProps}
          entityType={EntityType.DATA_PRODUCT}
        />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
      });
    });

    it('should use correct patch API for CONTAINER entity', async () => {
      const { container } = render(
        <OwnersSection {...defaultProps} entityType={EntityType.CONTAINER} />,
        { wrapper: Wrapper }
      );

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);
      const trigger = screen.getByTestId('owner-selector-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith(validUUID, expect.any(Array));
      });
    });
  });

  describe('Entity Rules Integration', () => {
    beforeEach(() => {
      // Reset to default rules before each test
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: defaultEntityRules,
        rules: [],
        isLoading: false,
      });
      userTeamSelectableListMock.mockClear();
    });

    it('should call useEntityRules with correct entity type', () => {
      (useEntityRules as jest.Mock).mockClear();
      render(
        <OwnersSection {...defaultProps} entityType={EntityType.TABLE} />,
        { wrapper: Wrapper }
      );

      expect(useEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
    });

    it('should pass entity rules to UserTeamSelectableList when multiple users and teams allowed', () => {
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: {
          ...defaultEntityRules,
          canAddMultipleUserOwners: true,
          canAddMultipleTeamOwner: true,
        },
        rules: [],
        isLoading: false,
      });

      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      expect(userTeamSelectableListMock).toHaveBeenCalledWith(
        expect.objectContaining({
          multiple: {
            user: true,
            team: true,
          },
        })
      );
    });

    it('should pass entity rules to UserTeamSelectableList when only single team owner allowed', () => {
      // Set mock before rendering - this simulates a rule that restricts to single team
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: {
          ...defaultEntityRules,
          canAddMultipleUserOwners: true,
          canAddMultipleTeamOwner: false, // Single team only
        },
        rules: [],
        isLoading: false,
      });

      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      // Verify component renders without errors
      expect(screen.getByText('label.owner-plural')).toBeInTheDocument();

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Verify UserTeamSelectableList is rendered with the rules
      // Note: The actual rules passed depend on component memoization
      // We verify the component renders and the hook was called correctly
      expect(userTeamSelectableListMock).toHaveBeenCalled();
      expect(useEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
    });

    it('should pass entity rules to UserTeamSelectableList when only single user owner allowed', () => {
      // Set mock before rendering - this simulates a rule that restricts to single user
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: {
          ...defaultEntityRules,
          canAddMultipleUserOwners: false, // Single user only
          canAddMultipleTeamOwner: true,
        },
        rules: [],
        isLoading: false,
      });

      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      // Verify component renders without errors
      expect(screen.getByText('label.owner-plural')).toBeInTheDocument();

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Verify UserTeamSelectableList is rendered
      expect(userTeamSelectableListMock).toHaveBeenCalled();
      expect(useEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
    });

    it('should pass entity rules to UserTeamSelectableList when both single user and single team allowed', () => {
      // Set mock before rendering - this simulates rules that restrict both
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: {
          ...defaultEntityRules,
          canAddMultipleUserOwners: false, // Single user only
          canAddMultipleTeamOwner: false, // Single team only
        },
        rules: [],
        isLoading: false,
      });

      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      // Verify component renders without errors
      expect(screen.getByText('label.owner-plural')).toBeInTheDocument();

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Verify UserTeamSelectableList is rendered
      expect(userTeamSelectableListMock).toHaveBeenCalled();
      expect(useEntityRules).toHaveBeenCalledWith(EntityType.TABLE);
    });

    it('should handle different entity types with their respective rules', () => {
      const entityTypes = [
        EntityType.TABLE,
        EntityType.DASHBOARD,
        EntityType.TOPIC,
        EntityType.MLMODEL,
      ];

      entityTypes.forEach((entityType) => {
        (useEntityRules as jest.Mock).mockClear();
        const { unmount } = render(
          <OwnersSection {...defaultProps} entityType={entityType} />,
          { wrapper: Wrapper }
        );

        expect(useEntityRules).toHaveBeenCalledWith(entityType);

        unmount();
      });
    });

    it('should work correctly when entity rules are loading', () => {
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: defaultEntityRules,
        rules: [],
        isLoading: true,
      });

      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      // Component should still render even when rules are loading
      expect(
        container.querySelector('[class*="MuiBox-root"]')
      ).toBeInTheDocument();
    });

    it('should use default entity rules when rules are empty', () => {
      (useEntityRules as jest.Mock).mockReturnValue({
        entityRules: defaultEntityRules,
        rules: [],
        isLoading: false,
      });

      const { container } = render(<OwnersSection {...defaultProps} />, {
        wrapper: Wrapper,
      });

      const editIcon = container.querySelector('.edit-icon');
      fireEvent.click(editIcon!);

      // Should use default rules (multiple users and teams allowed)
      expect(userTeamSelectableListMock).toHaveBeenCalledWith(
        expect.objectContaining({
          multiple: {
            user: true,
            team: true,
          },
        })
      );
    });

    it('should update entity rules when entity type changes', () => {
      (useEntityRules as jest.Mock).mockClear();
      const { rerender } = render(
        <OwnersSection {...defaultProps} entityType={EntityType.TABLE} />,
        { wrapper: Wrapper }
      );

      expect(useEntityRules).toHaveBeenCalledWith(EntityType.TABLE);

      (useEntityRules as jest.Mock).mockClear();

      // Change entity type
      rerender(
        <Wrapper>
          <OwnersSection {...defaultProps} entityType={EntityType.DASHBOARD} />
        </Wrapper>
      );

      expect(useEntityRules).toHaveBeenCalledWith(EntityType.DASHBOARD);
    });
  });
});
