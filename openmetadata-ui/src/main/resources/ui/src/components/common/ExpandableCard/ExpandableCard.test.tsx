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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import ExpandableCard from './ExpandableCard';

jest.mock('@openmetadata/ui-core-components', () => {
  const CardMock = ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  );
  CardMock.Header = ({ title, extra, className, ...props }: any) => (
    <div className={className} {...props}>
      {title}
      {extra}
    </div>
  );
  CardMock.Content = ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  );

  return {
    Card: CardMock,
    ButtonUtility: jest
      .fn()
      .mockImplementation(
        ({
          onClick,
          isDisabled,
          'data-testid': testId,
          tabIndex,
          className,
          tooltip,
        }: any) => (
          <button
            aria-label={tooltip}
            className={className}
            data-testid={testId}
            disabled={isDisabled}
            tabIndex={tabIndex}
            onClick={onClick}
          />
        )
      ),
  };
});

describe('ExpandableCard', () => {
  const mockT = jest.fn((key) => key);
  const mockOnExpandStateChange = jest.fn();
  const mockCardProps = {
    title: 'Test Card',
    className: 'test-class',
  };

  const getCardRoot = () =>
    screen
      .getByTestId('expand-collapse-icon')
      .closest('.new-header-border-card');

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with basic props', () => {
      render(
        <ExpandableCard cardProps={mockCardProps}>
          <div data-testid="test-content">Test Content</div>
        </ExpandableCard>
      );

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('renders with custom data-testid', () => {
      render(
        <ExpandableCard cardProps={mockCardProps} dataTestId="custom-test-id">
          <div>Test Content</div>
        </ExpandableCard>
      );

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('renders with complex nested children', () => {
      render(
        <ExpandableCard cardProps={mockCardProps}>
          <div data-testid="parent">
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">
              <span>Nested Content</span>
            </div>
          </div>
        </ExpandableCard>
      );

      expect(screen.getByTestId('parent')).toBeInTheDocument();
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByText('Nested Content')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('toggles expansion state on button click', async () => {
      render(
        <ExpandableCard cardProps={mockCardProps}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      const expandButton = screen.getByTestId('expand-collapse-icon');

      expect(getCardRoot()).toHaveClass('expanded');

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(getCardRoot()).toHaveClass('collapsed');
      expect(getCardRoot()).not.toHaveClass('expanded');

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(getCardRoot()).toHaveClass('expanded');
    });

    it('calls onExpandStateChange when expansion state changes', async () => {
      render(
        <ExpandableCard
          cardProps={mockCardProps}
          onExpandStateChange={mockOnExpandStateChange}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      const expandButton = screen.getByTestId('expand-collapse-icon');

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(mockOnExpandStateChange).toHaveBeenCalledWith(true);

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(mockOnExpandStateChange).toHaveBeenCalledWith(false);
    });

    it('disables expand/collapse when isExpandDisabled is true', () => {
      render(
        <ExpandableCard isExpandDisabled cardProps={mockCardProps}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      const expandButton = screen.getByTestId('expand-collapse-icon');

      expect(expandButton).toBeDisabled();
    });

    it('maintains expansion state when disabled', async () => {
      render(
        <ExpandableCard isExpandDisabled cardProps={mockCardProps}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      const expandButton = screen.getByTestId('expand-collapse-icon');

      expect(getCardRoot()).toHaveClass('expanded');

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(getCardRoot()).toHaveClass('expanded');
    });
  });

  describe('Styling', () => {
    it('applies custom className from cardProps', () => {
      render(
        <ExpandableCard
          cardProps={{
            ...mockCardProps,
            className: 'custom-class',
          }}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      expect(getCardRoot()).toHaveClass('custom-class');
    });

    it('applies default classes correctly', () => {
      render(
        <ExpandableCard cardProps={mockCardProps}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      expect(getCardRoot()).toHaveClass('new-header-border-card');
      expect(getCardRoot()).toHaveClass('expandable-card');
    });

    it('applies expanded class when expanded', () => {
      render(
        <ExpandableCard cardProps={mockCardProps}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      expect(getCardRoot()).toHaveClass('expanded');
    });
  });

  describe('Edge Cases', () => {
    it('works without onExpandStateChange callback', async () => {
      render(
        <ExpandableCard cardProps={mockCardProps}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      const expandButton = screen.getByTestId('expand-collapse-icon');

      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(getCardRoot()).not.toHaveClass('expanded');
      expect(getCardRoot()).toHaveClass('collapsed');
    });

    it('works with minimal cardProps', () => {
      render(
        <ExpandableCard cardProps={{}}>
          <div>Test Content</div>
        </ExpandableCard>
      );

      expect(screen.getByTestId('expand-collapse-icon')).toBeInTheDocument();
    });

    it('handles empty children', () => {
      render(<ExpandableCard cardProps={mockCardProps}>{null}</ExpandableCard>);

      expect(screen.getByTestId('expand-collapse-icon')).toBeInTheDocument();
    });
  });
});
