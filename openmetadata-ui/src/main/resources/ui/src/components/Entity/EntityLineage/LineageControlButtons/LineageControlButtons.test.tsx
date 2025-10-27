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
import { MemoryRouter } from 'react-router-dom';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/configuration/lineageSettings';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { getLoadingStatusValue } from '../../../../utils/EntityLineageUtils';
import LineageConfigModal from '../LineageConfigModal';
import LineageControlButtons from './LineageControlButtons';

const mockNavigate = jest.fn();
const mockOnLineageEditClick = jest.fn();
const mockOnExportClick = jest.fn();
const mockOnLineageConfigUpdate = jest.fn();
const mockToggleColumnView = jest.fn();
const mockZoomIn = jest.fn();
const mockZoomOut = jest.fn();
const mockFitView = jest.fn();
const mockRedraw = jest.fn();

const mockLineageConfig = {
  upstreamDepth: 3,
  downstreamDepth: 3,
  nodesPerLayer: 50,
};

const mockReactFlowInstance = {
  zoomIn: mockZoomIn,
  zoomOut: mockZoomOut,
  fitView: mockFitView,
};

const mockLineageProviderValues = {
  activeLayer: [],
  isEditMode: false,
  expandAllColumns: false,
  lineageConfig: mockLineageConfig,
  platformView: LineagePlatformView.None,
  toggleColumnView: mockToggleColumnView,
  onExportClick: mockOnExportClick,
  loading: false,
  status: 'success',
  onLineageEditClick: mockOnLineageEditClick,
  onLineageConfigUpdate: mockOnLineageConfigUpdate,
  reactFlowInstance: mockReactFlowInstance,
  redraw: mockRedraw,
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn(() => ({ search: '' })),
}));

jest.mock('../../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn(),
}));

jest.mock('../LineageConfigModal', () =>
  jest.fn(({ visible, onCancel, onSave }) =>
    visible ? (
      <div data-testid="lineage-config-modal">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => onSave(mockLineageConfig)}>Save</button>
      </div>
    ) : null
  )
);

jest.mock('../../../../utils/EntityLineageUtils', () => ({
  getLoadingStatusValue: jest.fn((icon) => icon),
}));

describe('LineageControlButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLineageProvider as jest.Mock).mockReturnValue(
      mockLineageProviderValues
    );
  });

  describe('Rendering', () => {
    it('should render all control buttons', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('edit-lineage')).toBeInTheDocument();
      expect(screen.getByTestId('lineage-export')).toBeInTheDocument();
      expect(screen.getByTestId('full-screen')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-in')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out')).toBeInTheDocument();
      expect(screen.getByTestId('fit-screen')).toBeInTheDocument();
      expect(screen.getByTestId('rearrange')).toBeInTheDocument();
      expect(screen.getByTestId('lineage-config')).toBeInTheDocument();
    });

    it('should not render edit button when entity is deleted', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            deleted
            hasEditAccess
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('edit-lineage')).not.toBeInTheDocument();
    });

    it('should not render edit button when platform view is not None', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        platformView: LineagePlatformView.Service,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('edit-lineage')).not.toBeInTheDocument();
    });

    it('should not render edit button when entity is a service type', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.DATABASE_SERVICE}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('edit-lineage')).not.toBeInTheDocument();
    });

    it('should not render edit button when entityType is not provided', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons hasEditAccess deleted={false} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('edit-lineage')).not.toBeInTheDocument();
    });

    it('should render expand column button when column layer is active and not in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('expand-column')).toBeInTheDocument();
    });

    it('should not render expand column button when in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
        isEditMode: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('expand-column')).not.toBeInTheDocument();
    });

    it('should not render expand column button when column layer is not active', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('expand-column')).not.toBeInTheDocument();
    });

    it('should show active state on edit button when in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        isEditMode: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      const editButton = screen.getByTestId('edit-lineage');

      expect(editButton).toHaveClass('active');
    });

    it('should show shrink icon when columns are expanded', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
        expandAllColumns: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('expand-column')).toBeInTheDocument();
      expect(
        screen.getByTestId('expand-column').querySelector('.anticon-shrink')
      ).toBeInTheDocument();
    });

    it('should show expand icon when columns are collapsed', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
        expandAllColumns: false,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('expand-column')).toBeInTheDocument();
      expect(
        screen.getByTestId('expand-column').querySelector('.anticon-arrows-alt')
      ).toBeInTheDocument();
    });
  });

  describe('Edit Lineage', () => {
    it('should call onLineageEditClick when edit button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('edit-lineage'));

      expect(mockOnLineageEditClick).toHaveBeenCalledTimes(1);
    });

    it('should disable edit button when user does not have edit access', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            deleted={false}
            entityType={EntityType.TABLE}
            hasEditAccess={false}
          />
        </MemoryRouter>
      );

      const editButton = screen.getByTestId('edit-lineage');

      expect(editButton).toBeDisabled();
    });

    it('should show correct tooltip when user has edit access', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      const editButton = screen.getByTestId('edit-lineage');

      expect(editButton).toHaveAttribute('title', 'label.edit-entity');
    });

    it('should show no permission tooltip when user does not have edit access', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            deleted={false}
            entityType={EntityType.TABLE}
            hasEditAccess={false}
          />
        </MemoryRouter>
      );

      const editButton = screen.getByTestId('edit-lineage');

      expect(editButton).toHaveAttribute(
        'title',
        'message.no-permission-for-action'
      );
    });
  });

  describe('Column Expand/Collapse', () => {
    it('should call toggleColumnView when expand column button is clicked', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('expand-column'));

      expect(mockToggleColumnView).toHaveBeenCalledTimes(1);
    });
  });

  describe('Export', () => {
    it('should call onExportClick when export button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('lineage-export'));

      expect(mockOnExportClick).toHaveBeenCalledTimes(1);
    });

    it('should disable export button when in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        isEditMode: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      const exportButton = screen.getByTestId('lineage-export');

      expect(exportButton).toBeDisabled();
    });
  });

  describe('Fullscreen', () => {
    it('should navigate to fullscreen view when fullscreen button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('full-screen'));

      expect(mockNavigate).toHaveBeenCalledWith({
        search: 'fullscreen=true',
      });
    });

    it('should exit fullscreen view when already in fullscreen', () => {
      (useCustomLocation as jest.Mock).mockReturnValueOnce({
        search: '?fullscreen=true',
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('exit-full-screen')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('exit-full-screen'));

      expect(mockNavigate).toHaveBeenCalledWith({ search: '' });
    });
  });

  describe('Zoom Controls', () => {
    it('should call zoomIn when zoom in button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(mockZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call zoomOut when zoom out button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('zoom-out'));

      expect(mockZoomOut).toHaveBeenCalledTimes(1);
    });

    it('should handle missing reactFlowInstance gracefully', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        reactFlowInstance: undefined,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(mockZoomIn).not.toHaveBeenCalled();
    });
  });

  describe('Fit View', () => {
    it('should call fitView with correct padding when fit screen button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));

      expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2 });
    });

    it('should handle missing reactFlowInstance gracefully for fit view', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        reactFlowInstance: undefined,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));

      expect(mockFitView).not.toHaveBeenCalled();
    });
  });

  describe('Rearrange', () => {
    it('should call redraw when rearrange button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('rearrange'));

      expect(mockRedraw).toHaveBeenCalledTimes(1);
    });

    it('should handle missing redraw function gracefully', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        redraw: undefined,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('rearrange'));

      expect(mockRedraw).not.toHaveBeenCalled();
    });
  });

  describe('Lineage Config', () => {
    it('should open config modal when settings button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('lineage-config'));

      expect(screen.getByTestId('lineage-config-modal')).toBeInTheDocument();
    });

    it('should disable config button when in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        isEditMode: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      const configButton = screen.getByTestId('lineage-config');

      expect(configButton).toBeDisabled();
    });

    it('should close modal when cancel is clicked', async () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('lineage-config'));

      expect(screen.getByTestId('lineage-config-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('lineage-config-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('should call onLineageConfigUpdate and close modal when save is clicked', async () => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('lineage-config'));

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnLineageConfigUpdate).toHaveBeenCalledWith(
          mockLineageConfig
        );
        expect(
          screen.queryByTestId('lineage-config-modal')
        ).not.toBeInTheDocument();
      });
    });

    it('should pass current lineageConfig to modal', () => {
      const customConfig = {
        upstreamDepth: 5,
        downstreamDepth: 5,
        nodesPerLayer: 100,
      };

      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        lineageConfig: customConfig,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('lineage-config'));

      expect(LineageConfigModal).toHaveBeenCalledWith(
        expect.objectContaining({
          config: customConfig,
          visible: true,
        }),
        expect.anything()
      );
    });
  });

  describe('Loading States', () => {
    it('should show loading state on edit button when loading', () => {
      (getLoadingStatusValue as jest.Mock).mockReturnValueOnce(
        <span>Loading...</span>
      );

      (useLineageProvider as jest.Mock).mockReturnValueOnce({
        ...mockLineageProviderValues,
        loading: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={EntityType.TABLE}
          />
        </MemoryRouter>
      );

      expect(getLoadingStatusValue).toHaveBeenCalled();
    });
  });

  describe('Multiple Entity Types', () => {
    it.each([
      EntityType.TABLE,
      EntityType.TOPIC,
      EntityType.DASHBOARD,
      EntityType.PIPELINE,
      EntityType.MLMODEL,
    ])('should render edit button for %s entity type', (entityType) => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={entityType}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('edit-lineage')).toBeInTheDocument();
    });

    it.each([
      EntityType.DATABASE_SERVICE,
      EntityType.DASHBOARD_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.MLMODEL_SERVICE,
    ])('should not render edit button for %s service type', (entityType) => {
      render(
        <MemoryRouter>
          <LineageControlButtons
            hasEditAccess
            deleted={false}
            entityType={entityType}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('edit-lineage')).not.toBeInTheDocument();
    });
  });
});
