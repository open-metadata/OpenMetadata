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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineageLayer } from '../../../../generated/configuration/lineageSettings';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import LineageControlButtons from './LineageControlButtons';

const mockNavigate = jest.fn();
const mockToggleColumnView = jest.fn();
const mockZoomIn = jest.fn();
const mockZoomOut = jest.fn();
const mockFitView = jest.fn();
const mockSetCenter = jest.fn();
const mockGetNodes = jest.fn();
const mockRedraw = jest.fn();
const mockZoomTo = jest.fn();

const mockReactFlowInstance = {
  zoomIn: mockZoomIn,
  zoomOut: mockZoomOut,
  zoomTo: mockZoomTo,
  fitView: mockFitView,
  setCenter: mockSetCenter,
  getNodes: mockGetNodes,
  getZoom: jest.fn().mockReturnValue(1),
};

const mockLineageProviderValues = {
  activeLayer: [],
  isEditMode: false,
  expandAllColumns: false,
  toggleColumnView: mockToggleColumnView,
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

const mockOnToggleMiniMap = jest.fn();
const mockProps = {
  onToggleMiniMap: mockOnToggleMiniMap,
  miniMapVisible: false,
};

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
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('fit-screen')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-mind-map')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-in')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out')).toBeInTheDocument();
      expect(screen.getByTestId('full-screen')).toBeInTheDocument();
    });

    it('should render expand column button when column layer is active and not in edit mode', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
      });

      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
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
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('expand-column')).not.toBeInTheDocument();
    });

    it('should not render expand column button when column layer is not active', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('expand-column')).not.toBeInTheDocument();
    });

    it('should show minimap as selected when miniMapVisible is true', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} miniMapVisible />
        </MemoryRouter>
      );

      const miniMapButton = screen.getByTestId('toggle-mind-map');

      expect(miniMapButton).toHaveClass('Mui-selected');
    });

    it('should show shrink icon when columns are expanded', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        activeLayer: [LineageLayer.ColumnLevelLineage],
        expandAllColumns: true,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
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
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('expand-column')).toBeInTheDocument();
      expect(
        screen.getByTestId('expand-column').querySelector('.anticon-arrows-alt')
      ).toBeInTheDocument();
    });
  });

  describe('MiniMap Toggle', () => {
    it('should call onToggleMiniMap when mind map button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('toggle-mind-map'));

      expect(mockOnToggleMiniMap).toHaveBeenCalledTimes(1);
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
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('expand-column'));

      expect(mockToggleColumnView).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fullscreen', () => {
    it('should navigate to fullscreen view when fullscreen button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
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
          <LineageControlButtons {...mockProps} />
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
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(mockZoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call zoomOut when zoom out button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
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
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(mockZoomIn).not.toHaveBeenCalled();
    });
  });

  describe('Lineage View Options Menu', () => {
    it('should open menu when fit screen button is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should call fitView when "Fit to screen" menu item is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));
      fireEvent.click(screen.getByText('label.fit-to-screen'));

      expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2 });
    });

    it('should call fitView with selected nodes when "Refocus to selected" is clicked', () => {
      const selectedNodes = [
        {
          id: '1',
          position: { x: 5, y: 5 },
          width: 10,
          height: 10,
          selected: true,
        },
        {
          id: '2',
          position: { x: 15, y: 15 },
          width: 10,
          height: 10,
          selected: true,
        },
      ];
      mockGetNodes.mockReturnValue(selectedNodes);

      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));
      fireEvent.click(screen.getByText('label.refocused-to-selected'));

      expect(mockSetCenter).toHaveBeenCalledWith(15, 50, {
        duration: 800,
        zoom: 0.65,
      });
    });

    it('should call redraw when "Rearrange nodes" is clicked', () => {
      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));
      fireEvent.click(screen.getByText('label.rearrange-nodes'));

      expect(mockRedraw).toHaveBeenCalledTimes(1);
    });

    it('should call setCenter when "Refocus to home" is clicked', () => {
      const selectedNodes = [
        { id: '1', selected: true, data: { isRootNode: false } },
        {
          id: '2',
          position: { x: 5, y: 5 },
          width: 20,
          selected: true,
          data: { isRootNode: true },
        },
      ];
      mockGetNodes.mockReturnValue(selectedNodes);

      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));
      fireEvent.click(screen.getByText('label.refocused-to-home'));

      expect(mockSetCenter).toHaveBeenCalledWith(25, 50, {
        duration: 800,
        zoom: 0.65,
      });
    });

    it('should handle missing reactFlowInstance gracefully', () => {
      (useLineageProvider as jest.Mock).mockReturnValue({
        ...mockLineageProviderValues,
        reactFlowInstance: undefined,
      });

      render(
        <MemoryRouter>
          <LineageControlButtons {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('fit-screen'));
      fireEvent.click(screen.getByText('label.fit-to-screen'));

      expect(mockFitView).not.toHaveBeenCalled();
    });
  });
});
