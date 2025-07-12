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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import CustomiseHomeModal from './CustomiseHomeModal';

// Mock dependencies
jest.mock('../../HeaderTheme/HeaderTheme', () => {
  return function MockHeaderTheme({
    selectedColor,
    setSelectedColor,
  }: {
    selectedColor: string;
    setSelectedColor: (color: string) => void;
  }) {
    return (
      <div data-testid="header-theme-component">
        <div data-testid="selected-color">{selectedColor}</div>
        <button
          data-testid="color-change-button"
          onClick={() => setSelectedColor('#ff0000')}>
          Change Color
        </button>
      </div>
    );
  };
});

// Mock AllWidgetsContent component
jest.mock('../AllWidgetsContent/AllWidgetsContent', () => {
  return function MockAllWidgetsContent() {
    return <div data-testid="all-widgets-content">All Widgets Content</div>;
  };
});

// Mock Ant Design Modal to avoid portal issues in tests
jest.mock('antd', () => {
  const antd = jest.requireActual('antd');

  return {
    ...antd,
    Modal: ({ children, open, onCancel, ...props }: any) =>
      open ? (
        <div data-testid="modal" {...props}>
          {children}
        </div>
      ) : null,
  };
});

describe('CustomiseHomeModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnBackgroundColorUpdate = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onBackgroundColorUpdate: mockOnBackgroundColorUpdate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should render modal when open is true', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should not render modal when open is false', () => {
      render(<CustomiseHomeModal {...defaultProps} open={false} />);

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render modal footer with action buttons', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('apply-btn')).toBeInTheDocument();
    });
  });

  describe('Sidebar Navigation', () => {
    it('should render sidebar options', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(
        screen.getByTestId('sidebar-option-header-theme')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('sidebar-option-all-widgets')
      ).toBeInTheDocument();
      expect(screen.getByText('label.header-theme')).toBeInTheDocument();
      expect(screen.getByText('label.all-widgets')).toBeInTheDocument();
    });

    it('should have header-theme selected by default', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const headerThemeOption = screen.getByTestId(
        'sidebar-option-header-theme'
      );

      expect(headerThemeOption).toHaveClass('active');
    });

    it('should switch active option when clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const allWidgetsOption = screen.getByTestId('sidebar-option-all-widgets');
      const headerThemeOption = screen.getByTestId(
        'sidebar-option-header-theme'
      );

      fireEvent.click(allWidgetsOption);

      expect(allWidgetsOption).toHaveClass('active');
      expect(headerThemeOption).not.toHaveClass('active');
    });
  });

  describe('Background Color Initialization', () => {
    it('should initialize with default color when no currentBackgroundColor is provided', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('selected-color')).toHaveTextContent(
        DEFAULT_HEADER_BG_COLOR
      );
    });

    it('should initialize with currentBackgroundColor when provided', () => {
      const customColor = '#123456';
      render(
        <CustomiseHomeModal
          {...defaultProps}
          currentBackgroundColor={customColor}
        />
      );

      expect(screen.getByTestId('selected-color')).toHaveTextContent(
        customColor
      );
    });

    it('should fallback to default color when currentBackgroundColor is undefined', () => {
      render(
        <CustomiseHomeModal
          {...defaultProps}
          currentBackgroundColor={undefined}
        />
      );

      expect(screen.getByTestId('selected-color')).toHaveTextContent(
        DEFAULT_HEADER_BG_COLOR
      );
    });
  });

  describe('Header Theme Functionality', () => {
    it('should update selected color when HeaderTheme component changes it', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      expect(screen.getByTestId('selected-color')).toHaveTextContent('#ff0000');
    });

    it('should maintain color selection across sidebar navigation', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      // Switch to another sidebar option and back
      const allWidgetsOption = screen.getByTestId('sidebar-option-all-widgets');
      const headerThemeOption = screen.getByTestId(
        'sidebar-option-header-theme'
      );

      fireEvent.click(allWidgetsOption);
      fireEvent.click(headerThemeOption);

      // Color should still be maintained
      expect(screen.getByTestId('selected-color')).toHaveTextContent('#ff0000');
    });
  });

  describe('Modal Actions', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-btn');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onBackgroundColorUpdate and onClose when apply button is clicked with color change', async () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color first
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      const applyButton = screen.getByTestId('apply-btn');
      await act(async () => {
        fireEvent.click(applyButton);
      });

      expect(mockOnBackgroundColorUpdate).toHaveBeenCalledWith('#ff0000');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onBackgroundColorUpdate with updated color when apply is clicked after color change', async () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      const applyButton = screen.getByTestId('apply-btn');
      await act(async () => {
        fireEvent.click(applyButton);
      });

      expect(mockOnBackgroundColorUpdate).toHaveBeenCalledWith('#ff0000');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onBackgroundColorUpdate when apply is clicked without color changes', () => {
      const customColor = '#abcdef';
      render(
        <CustomiseHomeModal
          {...defaultProps}
          currentBackgroundColor={customColor}
        />
      );

      const applyButton = screen.getByTestId('apply-btn');
      fireEvent.click(applyButton);

      // Should NOT call onBackgroundColorUpdate because color didn't change
      expect(mockOnBackgroundColorUpdate).not.toHaveBeenCalled();
    });

    it('should not call onBackgroundColorUpdate when cancel is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      // Cancel changes
      const cancelButton = screen.getByTestId('cancel-btn');
      fireEvent.click(cancelButton);

      expect(mockOnBackgroundColorUpdate).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle missing onBackgroundColorUpdate callback gracefully', () => {
      const propsWithoutCallback = {
        ...defaultProps,
        onBackgroundColorUpdate: undefined,
      };

      render(<CustomiseHomeModal {...propsWithoutCallback} />);

      // Change color first to trigger the condition
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      const applyButton = screen.getByTestId('apply-btn');

      // Should not throw error when callback is undefined
      expect(() => fireEvent.click(applyButton)).not.toThrow();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should enable apply button when color is changed', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      const applyButton = screen.getByTestId('apply-btn');

      expect(applyButton).not.toBeDisabled();
    });
  });

  describe('Content Switching', () => {
    it('should show header theme component by default', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('header-theme-component')).toBeInTheDocument();
      expect(
        screen.queryByTestId('all-widgets-content')
      ).not.toBeInTheDocument();
    });

    it('should show all widgets content when all-widgets option is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const allWidgetsOption = screen.getByTestId('sidebar-option-all-widgets');
      fireEvent.click(allWidgetsOption);

      expect(screen.getByTestId('all-widgets-content')).toBeInTheDocument();
      expect(
        screen.queryByTestId('header-theme-component')
      ).not.toBeInTheDocument();
    });
  });
});
