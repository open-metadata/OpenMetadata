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
import React from 'react';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import { useCurrentUserPreferences } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import CustomiseHomeModal from './CustomiseHomeModal';

// Mock dependencies
jest.mock('../../../../hooks/currentUserStore/useCurrentUserStore');

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

const mockUseCurrentUserPreferences = useCurrentUserPreferences as jest.Mock;

describe('CustomiseHomeModal Component', () => {
  const mockOnClose = jest.fn();
  const mockSetPreference = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
  };

  const mockPreferences = {
    homePageBannerBackgroundColor: DEFAULT_HEADER_BG_COLOR,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurrentUserPreferences.mockReturnValue({
      preferences: mockPreferences,
      setPreference: mockSetPreference,
    });
  });

  describe('Modal Rendering', () => {
    it('should render modal when open is true', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('label.customize-entity')).toBeInTheDocument();
    });

    it('should not render modal when open is false', () => {
      render(<CustomiseHomeModal {...defaultProps} open={false} />);

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render modal header with correct elements', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByText('label.customize-entity')).toBeInTheDocument();
      expect(screen.getByTestId('close-btn')).toBeInTheDocument();
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
      fireEvent.click(allWidgetsOption);

      expect(allWidgetsOption).toHaveClass('active');
      expect(screen.getByTestId('sidebar-option-header-theme')).not.toHaveClass(
        'active'
      );
    });
  });

  describe('Header Theme Functionality', () => {
    it('should initialize with default color when no preference is set', () => {
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: {},
        setPreference: mockSetPreference,
      });

      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('selected-color')).toHaveTextContent(
        DEFAULT_HEADER_BG_COLOR
      );
    });

    it('should initialize with saved preference color', () => {
      const customColor = '#123456';
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: { homePageBannerBackgroundColor: customColor },
        setPreference: mockSetPreference,
      });

      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('selected-color')).toHaveTextContent(
        customColor
      );
    });

    it('should update selected color when HeaderTheme component changes it', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      expect(screen.getByTestId('selected-color')).toHaveTextContent('#ff0000');
    });
  });

  describe('Modal Actions', () => {
    it('should call onClose when close icon is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-btn');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-btn');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should save preference and close modal when apply button is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      const applyButton = screen.getByTestId('apply-btn');
      fireEvent.click(applyButton);

      expect(mockSetPreference).toHaveBeenCalledWith({
        homePageBannerBackgroundColor: DEFAULT_HEADER_BG_COLOR,
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should save updated color when apply is clicked after color change', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      // Apply changes
      const applyButton = screen.getByTestId('apply-btn');
      fireEvent.click(applyButton);

      expect(mockSetPreference).toHaveBeenCalledWith({
        homePageBannerBackgroundColor: '#ff0000',
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not save preferences when cancel is clicked', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      // Change color
      const colorChangeButton = screen.getByTestId('color-change-button');
      fireEvent.click(colorChangeButton);

      // Cancel changes
      const cancelButton = screen.getByTestId('cancel-btn');
      fireEvent.click(cancelButton);

      expect(mockSetPreference).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Preferences Integration', () => {
    it('should call useCurrentUserPreferences hook', () => {
      render(<CustomiseHomeModal {...defaultProps} />);

      expect(mockUseCurrentUserPreferences).toHaveBeenCalled();
    });

    it('should handle undefined homePageBannerBackgroundColor preference', () => {
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: { someOtherPreference: 'value' },
        setPreference: mockSetPreference,
      });

      render(<CustomiseHomeModal {...defaultProps} />);

      expect(screen.getByTestId('selected-color')).toHaveTextContent(
        DEFAULT_HEADER_BG_COLOR
      );
    });
  });
});
