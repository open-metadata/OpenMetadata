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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityTitleSection } from './EntityTitleSection';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  )),
}));

const mockGetEntityIcon = jest.fn();

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: (entityType: string) => mockGetEntityIcon(entityType),
  },
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((entity) => {
    return entity?.displayName || entity?.name || '';
  }),
}));

jest.mock('../../../utils/BlockEditorUtils', () => ({
  getTextFromHtmlString: jest.fn().mockImplementation((str) => str),
}));

jest.mock('../../../utils/StringsUtils', () => ({
  stringToHTML: jest.fn().mockImplementation((str) => str),
}));

const mockPatchAPI = jest.fn();

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityPatchAPI: jest.fn().mockImplementation(() => mockPatchAPI),
  },
}));

const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

jest.mock('../../Modals/EntityNameModal/EntityNameModal.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ visible, onSave, onCancel }) => {
    if (!visible) {
      return null;
    }

    return (
      <div data-testid="entity-name-modal">
        <button
          data-testid="modal-save-button"
          onClick={() => onSave({ displayName: 'Updated Display Name' })}>
          Save
        </button>
        <button data-testid="modal-cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }),
}));

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

describe('EntityTitleSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityIcon.mockReturnValue(
      <span data-testid="entity-icon">Icon</span>
    );
  });

  describe('Entity Name Rendering', () => {
    it('should render entity name when displayName is not provided', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'test_entity_name' }}
          entityLink="/table/test_entity_name"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('test_entity_name')).toBeInTheDocument();
    });

    it('should render displayName when both name and displayName are provided', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'test_entity_name',
            displayName: 'Test Entity Display Name',
          }}
          entityLink="/table/test_entity_name"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Test Entity Display Name')).toBeInTheDocument();
    });

    it('should fallback to name when displayName is empty string', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'fallback_name', displayName: '' }}
          entityLink="/table/fallback_name"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('fallback_name')).toBeInTheDocument();
    });

    it('should handle entity with HTML in name', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity <b>bold</b>' }}
          entityLink="test-link"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Test Entity <b>bold</b>')).toBeInTheDocument();
    });
  });

  describe('Optional Props', () => {
    it('should use default testId when not provided', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test-link"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByTestId('entity-link')).toBeInTheDocument();
    });

    it('should use custom testId when provided', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test-link"
          testId="custom-test-id"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('should apply custom className when provided', () => {
      const { container } = render(
        <EntityTitleSection
          className="custom-class-name"
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test-link"
        />,
        { wrapper: Wrapper }
      );

      expect(container.querySelector('.custom-class-name')).toBeInTheDocument();
    });

    it('should apply drawer-title-section className correctly', () => {
      const { container } = render(
        <EntityTitleSection
          className="drawer-title-section"
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test-link"
        />,
        { wrapper: Wrapper }
      );

      expect(
        container.querySelector('.drawer-title-section')
      ).toBeInTheDocument();
    });

    it('should use default tooltipPlacement when not provided', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test-link"
        />,
        { wrapper: Wrapper }
      );

      // Component renders with default topLeft placement
      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });

    it('should accept custom tooltipPlacement', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test-link"
          tooltipPlacement="bottom"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });
  });

  describe('Entity Icon Rendering', () => {
    it('should render entity icon for table entity type', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'Test Table',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test"
        />,
        { wrapper: Wrapper }
      );

      expect(mockGetEntityIcon).toHaveBeenCalledWith(EntityType.TABLE);
      expect(screen.getByTestId('entity-icon')).toBeInTheDocument();
    });

    it('should render entity icon for dashboard entity type', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'Test Dashboard',
            entityType: EntityType.DASHBOARD,
          }}
          entityLink="/dashboard/test"
        />,
        { wrapper: Wrapper }
      );

      expect(mockGetEntityIcon).toHaveBeenCalledWith(EntityType.DASHBOARD);
    });

    it('should render entity icon for pipeline entity type', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'Test Pipeline',
            entityType: EntityType.PIPELINE,
          }}
          entityLink="/pipeline/test"
        />,
        { wrapper: Wrapper }
      );

      expect(mockGetEntityIcon).toHaveBeenCalledWith(EntityType.PIPELINE);
    });

    it('should render entity icon for topic entity type', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'Test Topic',
            entityType: EntityType.TOPIC,
          }}
          entityLink="/topic/test"
        />,
        { wrapper: Wrapper }
      );

      expect(mockGetEntityIcon).toHaveBeenCalledWith(EntityType.TOPIC);
    });

    it('should render entity icon for ML model entity type', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'Test ML Model',
            entityType: EntityType.MLMODEL,
          }}
          entityLink="/mlmodel/test"
        />,
        { wrapper: Wrapper }
      );

      expect(mockGetEntityIcon).toHaveBeenCalledWith(EntityType.MLMODEL);
    });

    it('should handle empty entityType gracefully', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/test"
        />,
        { wrapper: Wrapper }
      );

      expect(mockGetEntityIcon).toHaveBeenCalledWith('');
    });
  });

  describe('Link Navigation Behavior', () => {
    it('should render link with correct href when entityLink is a string', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink="/table/test-entity"
        />,
        { wrapper: Wrapper }
      );

      const link = screen.getByTestId('entity-link');

      expect(link).toHaveAttribute('href', '/table/test-entity');
    });

    it('should render link with pathname when entityLink is an object', () => {
      render(
        <EntityTitleSection
          entityDetails={{ name: 'Test Entity' }}
          entityLink={{ pathname: '/dashboard/test-dashboard' }}
        />,
        { wrapper: Wrapper }
      );

      const link = screen.getByTestId('entity-link');

      expect(link).toHaveAttribute('href', '/dashboard/test-dashboard');
    });
  });

  describe('Entity Details with fullyQualifiedName', () => {
    it('should render entity with fullyQualifiedName in details', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'test_table',
            displayName: 'Test Table',
            fullyQualifiedName: 'database.schema.test_table',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/database.schema.test_table"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Test Table')).toBeInTheDocument();
      expect(screen.getByTestId('entity-link')).toHaveAttribute(
        'href',
        '/table/database.schema.test_table'
      );
    });
  });

  describe('entityDisplayName prop', () => {
    it('should use entityDisplayName prop over entityDetails.displayName when provided', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'test_entity',
            displayName: 'Original Display Name',
          }}
          entityDisplayName="Overridden Display Name"
          entityLink="/table/test_entity"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Overridden Display Name')).toBeInTheDocument();
    });

    it('should fall back to entityDetails.displayName when entityDisplayName is undefined', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            name: 'test_entity',
            displayName: 'Original Display Name',
          }}
          entityLink="/table/test_entity"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Original Display Name')).toBeInTheDocument();
    });

    it('should update displayed name when entityDisplayName prop changes', () => {
      const { rerender } = render(
        <EntityTitleSection
          entityDetails={{
            name: 'test_entity',
            displayName: 'Original Display Name',
          }}
          entityDisplayName="First Display Name"
          entityLink="/table/test_entity"
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('First Display Name')).toBeInTheDocument();

      rerender(
        <Wrapper>
          <EntityTitleSection
            entityDetails={{
              name: 'test_entity',
              displayName: 'Original Display Name',
            }}
            entityDisplayName="Updated Display Name"
            entityLink="/table/test_entity"
          />
        </Wrapper>
      );

      expect(screen.getByText('Updated Display Name')).toBeInTheDocument();
    });
  });

  describe('Edit Display Name Button', () => {
    it('should not render edit button when hasEditPermission is false', () => {
      render(
        <EntityTitleSection
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
          hasEditPermission={false}
        />,
        { wrapper: Wrapper }
      );

      expect(
        screen.queryByTestId('edit-displayName-button')
      ).not.toBeInTheDocument();
    });

    it('should not render edit button when entityType is not provided', () => {
      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
          }}
          entityLink="/table/test_entity"
        />,
        { wrapper: Wrapper }
      );

      expect(
        screen.queryByTestId('edit-displayName-button')
      ).not.toBeInTheDocument();
    });

    it('should not render edit button when entityDetails.id is not provided', () => {
      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      expect(
        screen.queryByTestId('edit-displayName-button')
      ).not.toBeInTheDocument();
    });

    it('should render edit button when all conditions are met', () => {
      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      expect(screen.getByTestId('edit-displayName-button')).toBeInTheDocument();
    });

    it('should open EntityNameModal when edit button is clicked', async () => {
      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            displayName: 'Test Entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('entity-name-modal')).toBeInTheDocument();
    });

    it('should close modal when cancel is clicked', async () => {
      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('entity-name-modal')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('modal-cancel-button');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(screen.queryByTestId('entity-name-modal')).not.toBeInTheDocument();
    });
  });

  describe('handleDisplayNameUpdate', () => {
    beforeEach(() => {
      mockPatchAPI.mockReset();
      mockShowSuccessToast.mockReset();
      mockShowErrorToast.mockReset();
    });

    it('should call API and onDisplayNameUpdate callback on successful update', async () => {
      const mockOnDisplayNameUpdate = jest.fn();
      mockPatchAPI.mockResolvedValue({ displayName: 'Updated Display Name' });

      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            displayName: 'Original Name',
            entityType: EntityType.TABLE,
          }}
          entityDisplayName="Original Name"
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
          onDisplayNameUpdate={mockOnDisplayNameUpdate}
        />,
        { wrapper: Wrapper }
      );

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByTestId('modal-save-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith('test-id', [
          {
            op: 'replace',
            path: '/displayName',
            value: 'Updated Display Name',
          },
        ]);
      });

      expect(mockShowSuccessToast).toHaveBeenCalled();
      expect(mockOnDisplayNameUpdate).toHaveBeenCalledWith(
        'Updated Display Name'
      );
    });

    it('should use "add" operation when entityDisplayName is not set', async () => {
      const mockOnDisplayNameUpdate = jest.fn();
      mockPatchAPI.mockResolvedValue({ displayName: 'Updated Display Name' });

      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
          onDisplayNameUpdate={mockOnDisplayNameUpdate}
        />,
        { wrapper: Wrapper }
      );

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByTestId('modal-save-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockPatchAPI).toHaveBeenCalledWith('test-id', [
          {
            op: 'add',
            path: '/displayName',
            value: 'Updated Display Name',
          },
        ]);
      });
    });

    it('should show error toast on API failure', async () => {
      const mockError = new Error('API Error');
      mockPatchAPI.mockRejectedValue(mockError);

      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            id: 'test-id',
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      const editButton = screen.getByTestId('edit-displayName-button');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByTestId('modal-save-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalled();
      });
    });

    it('should close modal without API call when id or entityType is missing', async () => {
      render(
        <EntityTitleSection
          hasEditPermission
          entityDetails={{
            name: 'test_entity',
            entityType: EntityType.TABLE,
          }}
          entityLink="/table/test_entity"
          entityType={EntityType.TABLE}
        />,
        { wrapper: Wrapper }
      );

      expect(
        screen.queryByTestId('edit-displayName-button')
      ).not.toBeInTheDocument();
    });
  });
});
