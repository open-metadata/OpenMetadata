/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2024 Collate.
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

import { act, render, screen } from '@testing-library/react';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { DynamicHeightWidget } from './DynamicHeightWidget';

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

const mockResizeObserver = new MockResizeObserver();

// Mock the ResizeObserver constructor
global.ResizeObserver = jest.fn().mockImplementation(() => mockResizeObserver);

describe('DynamicHeightWidget', () => {
  const mockWidget: WidgetConfig = {
    i: 'test-widget',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
  };

  const mockOnHeightChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div data-testid="test-child">Test Content</div>
        </DynamicHeightWidget>
      );

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders with correct initial class', () => {
      const { container } = render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      expect(
        container.getElementsByClassName('dynamic-height-widget')[0]
      ).toHaveClass('dynamic-height-widget');
    });

    it('renders with complex nested children', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div data-testid="parent">
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">
              <span>Nested Content</span>
            </div>
          </div>
        </DynamicHeightWidget>
      );

      expect(screen.getByTestId('parent')).toBeInTheDocument();
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByText('Nested Content')).toBeInTheDocument();
    });
  });

  describe('Height Change Handling', () => {
    it('calls onHeightChange when height increases', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];
      resizeCallback([{ contentRect: { height: 600 } }]); // 6 grid units

      expect(mockOnHeightChange).toHaveBeenCalledWith('test-widget', 6);
    });

    it('calls onHeightChange when height decreases', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];
      resizeCallback([{ contentRect: { height: 200 } }]); // 2 grid units

      expect(mockOnHeightChange).toHaveBeenCalledWith('test-widget', 2);
    });

    it('does not call onHeightChange when height remains the same', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];
      resizeCallback([{ contentRect: { height: 400 } }]); // 4 grid units (same as initial)

      expect(mockOnHeightChange).not.toHaveBeenCalled();
    });

    it('handles multiple resize events correctly', async () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];

      // First resize
      resizeCallback([{ contentRect: { height: 300 } }]);

      expect(mockOnHeightChange).toHaveBeenCalledWith('test-widget', 3);

      await act(async () => {
        // Second resize
        resizeCallback([{ contentRect: { height: 500 } }]);
      });

      expect(mockOnHeightChange).toHaveBeenCalledWith('test-widget', 5);

      // Third resize (same height)
      resizeCallback([{ contentRect: { height: 500 } }]);

      expect(mockOnHeightChange).toHaveBeenCalledTimes(3); // Should not increase call count
    });
  });

  describe('Edge Cases', () => {
    it('handles zero height correctly', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];
      resizeCallback([{ contentRect: { height: 0 } }]);

      expect(mockOnHeightChange).toHaveBeenCalledWith('test-widget', 0);
    });

    it('handles very large height values', () => {
      render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];
      resizeCallback([{ contentRect: { height: 10000 } }]);

      expect(mockOnHeightChange).toHaveBeenCalledWith('test-widget', 100);
    });

    it('works without onHeightChange callback', () => {
      render(
        <DynamicHeightWidget widget={mockWidget}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      const resizeCallback = (global.ResizeObserver as jest.Mock).mock
        .calls[0][0];
      resizeCallback([{ contentRect: { height: 500 } }]);

      // Should not throw any errors
      expect(() => {
        resizeCallback([{ contentRect: { height: 500 } }]);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('cleans up ResizeObserver on unmount', () => {
      const { unmount } = render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      unmount();

      expect(mockResizeObserver.disconnect).toHaveBeenCalled();
    });

    it('cleans up ResizeObserver when widget ID changes', () => {
      const { rerender } = render(
        <DynamicHeightWidget
          widget={mockWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      // Change widget ID
      const newWidget = { ...mockWidget, i: 'new-widget-id' };
      rerender(
        <DynamicHeightWidget
          widget={newWidget}
          onHeightChange={mockOnHeightChange}>
          <div>Test Content</div>
        </DynamicHeightWidget>
      );

      // Should create a new ResizeObserver instance
      expect(global.ResizeObserver).toHaveBeenCalledTimes(2);
    });
  });
});
