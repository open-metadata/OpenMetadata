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
import { headerBackgroundColors } from '../../../constants/Mydata.constants';
import HeaderTheme from './HeaderTheme';

// Mock dependencies
jest.mock(
  '../CustomizableComponents/CustomiseLandingPageHeader/CustomiseLandingPageHeader',
  () => {
    return function MockCustomiseLandingPageHeader({
      backgroundColor,
      hideCustomiseButton,
    }: {
      backgroundColor: string;
      hideCustomiseButton: boolean;
    }) {
      return (
        <div
          data-background-color={backgroundColor}
          data-hide-customise-button={hideCustomiseButton}
          data-testid="customise-landing-page-header">
          Mock Landing Page Header
        </div>
      );
    };
  }
);

describe('HeaderTheme Component', () => {
  const mockSetSelectedColor = jest.fn();
  const defaultSelectedColor = '#1890ff';

  const defaultProps = {
    selectedColor: defaultSelectedColor,
    setSelectedColor: mockSetSelectedColor,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render HeaderTheme component with all elements', () => {
      render(<HeaderTheme {...defaultProps} />);

      expect(screen.getByText('label.preview-header')).toBeInTheDocument();
      expect(screen.getByText('label.select-background')).toBeInTheDocument();
      expect(screen.getByText('label.custom')).toBeInTheDocument();
      expect(
        screen.getByTestId('customise-landing-page-header')
      ).toBeInTheDocument();
    });

    it('should render preview header with correct props', () => {
      render(<HeaderTheme {...defaultProps} />);

      const previewHeader = screen.getByTestId('customise-landing-page-header');

      expect(previewHeader).toHaveAttribute(
        'data-background-color',
        defaultSelectedColor
      );
      expect(previewHeader).toHaveAttribute(
        'data-hide-customise-button',
        'true'
      );
    });

    it('should display selected color in custom preview', () => {
      render(<HeaderTheme {...defaultProps} />);

      expect(screen.getByText(defaultSelectedColor)).toBeInTheDocument();
    });

    it('should render custom color preview with correct styling', () => {
      render(<HeaderTheme {...defaultProps} />);

      const colorPreview = document.querySelector('.color-preview');
      const colorPreviewInner = document.querySelector('.color-preview-inner');

      expect(colorPreview).toHaveStyle(`border-color: ${defaultSelectedColor}`);
      expect(colorPreviewInner).toHaveStyle(
        `background-color: ${defaultSelectedColor}`
      );
    });

    it('should render all available color options', () => {
      render(<HeaderTheme {...defaultProps} />);

      const colorOptions = document.querySelectorAll('.option-color');

      expect(colorOptions).toHaveLength(headerBackgroundColors.length);

      headerBackgroundColors.forEach((colorOption, index) => {
        const optionElement = colorOptions[index];

        expect(optionElement).toHaveStyle(
          `background-color: ${colorOption.color}`
        );
        expect(optionElement).toHaveStyle(`border-color: ${colorOption.color}`);
      });
    });
  });

  describe('Color Selection Functionality', () => {
    it('should call setSelectedColor when a color option is clicked', () => {
      render(<HeaderTheme {...defaultProps} />);

      const firstColorOption = document.querySelector('.option-color');
      fireEvent.click(firstColorOption!);

      expect(mockSetSelectedColor).toHaveBeenCalledTimes(1);
      expect(mockSetSelectedColor).toHaveBeenCalledWith(
        headerBackgroundColors[0].color
      );
    });

    it('should call setSelectedColor with correct color for each option', () => {
      render(<HeaderTheme {...defaultProps} />);

      const colorOptions = document.querySelectorAll('.option-color');

      headerBackgroundColors.forEach((colorOption, index) => {
        fireEvent.click(colorOptions[index]);

        expect(mockSetSelectedColor).toHaveBeenCalledWith(colorOption.color);
      });

      expect(mockSetSelectedColor).toHaveBeenCalledTimes(
        headerBackgroundColors.length
      );
    });

    it('should handle multiple color selections', () => {
      render(<HeaderTheme {...defaultProps} />);

      const colorOptions = document.querySelectorAll('.option-color');

      // Click first color
      fireEvent.click(colorOptions[0]);

      expect(mockSetSelectedColor).toHaveBeenCalledWith(
        headerBackgroundColors[0].color
      );

      // Click second color
      fireEvent.click(colorOptions[1]);

      expect(mockSetSelectedColor).toHaveBeenCalledWith(
        headerBackgroundColors[1].color
      );

      expect(mockSetSelectedColor).toHaveBeenCalledTimes(2);
    });
  });

  describe('Props Handling', () => {
    it('should update preview when selectedColor prop changes', () => {
      const customColor = '#ff0000';
      const { rerender } = render(<HeaderTheme {...defaultProps} />);

      // Initial render
      expect(screen.getByText(defaultSelectedColor)).toBeInTheDocument();

      // Rerender with new color
      rerender(<HeaderTheme {...defaultProps} selectedColor={customColor} />);

      expect(screen.getByText(customColor)).toBeInTheDocument();
      expect(screen.queryByText(defaultSelectedColor)).not.toBeInTheDocument();
    });

    it('should pass updated backgroundColor to preview header', () => {
      const customColor = '#00ff00';
      const { rerender } = render(<HeaderTheme {...defaultProps} />);

      // Initial render
      let previewHeader = screen.getByTestId('customise-landing-page-header');

      expect(previewHeader).toHaveAttribute(
        'data-background-color',
        defaultSelectedColor
      );

      // Rerender with new color
      rerender(<HeaderTheme {...defaultProps} selectedColor={customColor} />);

      previewHeader = screen.getByTestId('customise-landing-page-header');

      expect(previewHeader).toHaveAttribute(
        'data-background-color',
        customColor
      );
    });
  });
});
