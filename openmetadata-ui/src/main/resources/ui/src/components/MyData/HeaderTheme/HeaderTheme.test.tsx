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
import type { CSSProperties, ReactNode } from 'react';
import {
  DEFAULT_HEADER_BG_COLOR,
  headerBackgroundColors,
} from '../../../constants/Mydata.constants';
import { getLandingPageHeaderTintStyle } from '../HomeLandingPage/landingPageHeaderColor';
import HeaderTheme from './HeaderTheme';

// jsdom drops a `linear-gradient(...)` background, so the header is stubbed to
// expose the treatment it was handed instead.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  PageHeader: jest
    .fn()
    .mockImplementation(
      ({
        icon,
        style,
        subtitle,
        title,
        variant,
        'data-testid': dataTestId,
      }: {
        icon?: ReactNode;
        style?: CSSProperties;
        subtitle?: ReactNode;
        title: ReactNode;
        variant?: string;
        'data-testid'?: string;
      }) => (
        <div
          data-background-image={style?.backgroundImage}
          data-testid={dataTestId}
          data-variant={variant}>
          {icon}
          {title}
          {subtitle}
        </div>
      )
    ),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: { name: 'jane_doe' },
  })),
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(() => <div data-testid="profile-picture" />)
);

describe('HeaderTheme Component', () => {
  const mockSetSelectedColor = jest.fn();
  const defaultSelectedColor = DEFAULT_HEADER_BG_COLOR;

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
      expect(screen.getByTestId('modal-header-theme')).toBeInTheDocument();
    });

    it('should preview the home page header for the current user', () => {
      render(<HeaderTheme {...defaultProps} />);

      const previewHeader = screen.getByTestId('modal-header-theme');

      expect(previewHeader).toHaveTextContent('message.hi-user');
      expect(previewHeader).toHaveTextContent(
        'message.home-landing-page-subtitle'
      );
      expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
    });

    it('should keep the default header when the colour is the legacy gradient', () => {
      render(<HeaderTheme {...defaultProps} />);

      const previewHeader = screen.getByTestId('modal-header-theme');

      expect(previewHeader).toHaveAttribute('data-variant', 'gradient');
      expect(previewHeader).not.toHaveAttribute('data-background-image');
    });
  });

  describe('Color Selection Functionality', () => {
    it('should call setSelectedColor when a color option is clicked', () => {
      render(<HeaderTheme {...defaultProps} />);

      const firstColorOption = document.querySelector(
        '.option-color'
      ) as HTMLElement;
      fireEvent.click(firstColorOption);

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
    it('should tint the preview with the selected colour as the home page does', () => {
      const { rerender } = render(<HeaderTheme {...defaultProps} />);

      rerender(
        <HeaderTheme
          {...defaultProps}
          selectedColor={headerBackgroundColors[1].color}
        />
      );

      const previewHeader = screen.getByTestId('modal-header-theme');

      expect(previewHeader).toHaveAttribute('data-variant', 'flat');
      expect(previewHeader).toHaveAttribute(
        'data-background-image',
        getLandingPageHeaderTintStyle(headerBackgroundColors[1].color)
          ?.backgroundImage
      );
    });
  });
});
