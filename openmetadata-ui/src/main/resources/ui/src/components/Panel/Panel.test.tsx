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

import { render, screen } from '@testing-library/react';
import { Panel } from './Panel.component';
import { PanelProps } from './Panel.interface';

const mockOnClose = jest.fn();
const mockOnSave = jest.fn();

const defaultProps: PanelProps = {
  open: true,
  onClose: mockOnClose,
  title: 'Test Panel',
  children: <div>Panel Content</div>,
  closable: true,
};

const renderPanel = (props: Partial<PanelProps> = {}) => {
  return render(<Panel {...defaultProps} {...props} />);
};

describe('Panel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render panel with title and content', () => {
    renderPanel();

    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('panel-title')).toHaveTextContent('Test Panel');
    expect(screen.getByTestId('panel-content')).toHaveTextContent(
      'Panel Content'
    );
  });

  it('should render panel with description when provided', () => {
    const description = 'This is a test description';
    renderPanel({ description });

    expect(screen.getByTestId('panel-description')).toHaveTextContent(
      description
    );
  });

  it('should not render description when not provided', () => {
    renderPanel();

    expect(screen.queryByTestId('panel-description')).not.toBeInTheDocument();
  });

  it('should render close button by default', () => {
    renderPanel();

    expect(screen.getByTestId('panel-close-button')).toBeInTheDocument();
  });

  it('should not render close button when closable is false', () => {
    renderPanel({ closable: false });

    expect(screen.queryByTestId('panel-close-button')).not.toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    const footer = <div>Footer Content</div>;
    renderPanel({ footer });

    // Custom footer is rendered directly in ant-drawer-footer without panel-footer wrapper
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('should render permanent Cancel and Save buttons when no footer is provided', () => {
    renderPanel({ onSave: mockOnSave });

    expect(screen.getByTestId('panel-footer')).toBeInTheDocument();
    expect(screen.getByTestId('panel-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('panel-save-button')).toBeInTheDocument();
  });

  it('should render default button labels when not provided', () => {
    renderPanel({ onSave: mockOnSave });

    expect(screen.getByTestId('panel-cancel-button')).toHaveTextContent(
      'label.cancel'
    );
    expect(screen.getByTestId('panel-save-button')).toHaveTextContent(
      'label.save'
    );
  });

  it('should render custom button labels when provided', () => {
    renderPanel({
      cancelLabel: 'Discard',
      saveLabel: 'Submit',
    });

    expect(screen.getByTestId('panel-cancel-button')).toHaveTextContent(
      'Discard'
    );
    expect(screen.getByTestId('panel-save-button')).toHaveTextContent('Submit');
  });

  it('should disable Save button when saveDisabled is true', () => {
    renderPanel({ saveDisabled: true });

    const saveButton = screen.getByTestId('panel-save-button');

    expect(saveButton).toBeDisabled();
  });

  it('should show loading state on Save button when saveLoading is true', () => {
    renderPanel({ saveLoading: true });

    const saveButton = screen.getByTestId('panel-save-button');

    expect(saveButton).toHaveClass('ant-btn-loading');
  });

  it('should apply custom className', () => {
    const customClass = 'custom-panel-class';
    renderPanel({ className: customClass });

    // Custom className is applied to the Drawer component, not the content wrapper
    const drawer = document.querySelector('.ant-drawer');

    expect(drawer).toHaveClass('panel-container', customClass);
  });

  it('should use custom data-testid when provided', () => {
    const customTestId = 'custom-panel';
    renderPanel({ 'data-testid': customTestId });

    expect(screen.getByTestId(customTestId)).toBeInTheDocument();
    expect(screen.getByTestId(`${customTestId}-title`)).toBeInTheDocument();
    expect(screen.getByTestId(`${customTestId}-content`)).toBeInTheDocument();
    expect(
      screen.getByTestId(`${customTestId}-cancel-button`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${customTestId}-save-button`)
    ).toBeInTheDocument();
  });

  it('should handle different placement values', () => {
    const placements: Array<'left' | 'right' | 'top' | 'bottom'> = [
      'left',
      'right',
      'top',
      'bottom',
    ];

    placements.forEach((placement) => {
      const { unmount } = renderPanel({ placement });

      // Panel should render without errors for each placement
      expect(screen.getByTestId('panel')).toBeInTheDocument();

      unmount();
    });
  });

  it('should handle different size values', () => {
    const sizes = [500, '50%', 'auto'];

    sizes.forEach((size) => {
      const { unmount } = renderPanel({ size });

      // Panel should render without errors for each size
      expect(screen.getByTestId('panel')).toBeInTheDocument();

      unmount();
    });
  });

  it('should not render when open is false', () => {
    renderPanel({ open: false });

    // Ant Design Drawer with open=false should not render visible content
    expect(screen.queryByTestId('panel-title')).not.toBeInTheDocument();
  });

  it('should handle mask and maskClosable props', () => {
    renderPanel({ mask: false, maskClosable: false });

    // Panel should still render with these props
    expect(screen.getByTestId('panel')).toBeInTheDocument();
  });

  it('should prioritize custom footer over permanent buttons', () => {
    const customFooter = <div>Custom Footer</div>;
    renderPanel({ footer: customFooter });

    expect(screen.getByText('Custom Footer')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-cancel-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-save-button')).not.toBeInTheDocument();
  });
});
