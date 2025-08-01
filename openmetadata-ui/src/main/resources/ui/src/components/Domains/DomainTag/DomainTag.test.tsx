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
import { DomainTag } from './DomainTag.component';

const mockOnRemove = jest.fn();
const mockOnClick = jest.fn();

const defaultProps = {
  label: 'Production',
  'data-testid': 'test-domain-tag',
};

describe('DomainTag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the domain tag with label', () => {
    render(<DomainTag {...defaultProps} />);

    expect(screen.getByTestId('test-domain-tag')).toBeInTheDocument();
    expect(screen.getByTestId('tag-label')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('should render the tag icon', () => {
    render(<DomainTag {...defaultProps} />);

    expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
  });

  it('should not render close button when removable is false', () => {
    render(<DomainTag {...defaultProps} removable={false} />);

    expect(screen.queryByTestId('tag-close')).not.toBeInTheDocument();
  });

  it('should render close button when removable is true', () => {
    render(<DomainTag {...defaultProps} removable onRemove={mockOnRemove} />);

    expect(screen.getByTestId('tag-close')).toBeInTheDocument();
  });

  it('should call onRemove when close button is clicked', () => {
    render(<DomainTag {...defaultProps} removable onRemove={mockOnRemove} />);

    const closeButton = screen.getByTestId('tag-close');
    fireEvent.click(closeButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('should call onClick when tag is clicked', () => {
    render(<DomainTag {...defaultProps} onClick={mockOnClick} />);

    const tag = screen.getByTestId('test-domain-tag');
    fireEvent.click(tag);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation when close button is clicked', () => {
    render(
      <DomainTag
        {...defaultProps}
        removable
        onClick={mockOnClick}
        onRemove={mockOnRemove}
      />
    );

    const closeButton = screen.getByTestId('tag-close');
    fireEvent.click(closeButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should render with custom className', () => {
    const { container } = render(
      <DomainTag {...defaultProps} className="custom-class" />
    );

    const tag = container.querySelector('.domain-tag');

    expect(tag).toHaveClass('custom-class');
  });

  it('should apply clickable class when onClick is provided', () => {
    const { container } = render(
      <DomainTag {...defaultProps} onClick={mockOnClick} />
    );

    const tag = container.querySelector('.domain-tag');

    expect(tag).toHaveClass('domain-tag-clickable');
  });

  it('should apply removable class when removable is true', () => {
    const { container } = render(
      <DomainTag {...defaultProps} removable onRemove={mockOnRemove} />
    );

    const tag = container.querySelector('.domain-tag');

    expect(tag).toHaveClass('domain-tag-removable');
  });

  it('should render different sizes', () => {
    const { container } = render(<DomainTag {...defaultProps} size="small" />);

    const tag = container.querySelector('.domain-tag');

    expect(tag).toHaveClass('domain-tag-small');
  });

  it('should use default data-testid when not provided', () => {
    render(<DomainTag label="Test" />);

    expect(screen.getByTestId('domain-tag')).toBeInTheDocument();
  });

  it('should have pointer cursor when onClick is provided', () => {
    render(<DomainTag {...defaultProps} onClick={mockOnClick} />);

    const tag = screen.getByTestId('test-domain-tag');

    expect(tag).toHaveStyle('cursor: pointer');
  });

  it('should have default cursor when onClick is not provided', () => {
    render(<DomainTag {...defaultProps} />);

    const tag = screen.getByTestId('test-domain-tag');

    expect(tag).toHaveStyle('cursor: default');
  });
});
