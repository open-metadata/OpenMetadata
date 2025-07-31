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
import { MemoryRouter } from 'react-router-dom';
import WidgetWrapper from './WidgetWrapper';

const mockProps = {
  children: <div data-testid="widget-content">Widget Content</div>,
  loading: false,
  dataLength: 5,
  className: 'custom-wrapper-class',
  dataTestId: 'widget-wrapper',
};

const renderWidgetWrapper = (props = {}) => {
  return render(
    <MemoryRouter>
      <WidgetWrapper {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('WidgetWrapper', () => {
  it('renders children content', () => {
    renderWidgetWrapper();

    expect(screen.getByTestId('widget-content')).toBeInTheDocument();
    expect(screen.getByText('Widget Content')).toBeInTheDocument();
  });

  it('renders with loading state', () => {
    renderWidgetWrapper({ loading: true });

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('entity-list-skeleton')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWidgetWrapper();

    const wrapper = screen.getByTestId('widget-wrapper');

    expect(wrapper).toHaveClass('custom-wrapper-class');
  });

  it('renders with default props', () => {
    renderWidgetWrapper({
      children: <div>Default Content</div>,
      loading: undefined,
      dataLength: undefined,
      className: undefined,
    });

    expect(screen.getByText('Default Content')).toBeInTheDocument();
    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('renders complex children content', () => {
    const complexChildren = (
      <>
        <div data-testid="header">Header</div>
        <div data-testid="body">Body</div>
        <div data-testid="footer">Footer</div>
      </>
    );

    renderWidgetWrapper({ children: complexChildren });

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('handles empty children gracefully', () => {
    renderWidgetWrapper({ children: null });

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('renders with different loading states', () => {
    const { rerender } = renderWidgetWrapper({ loading: false });

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <WidgetWrapper {...mockProps} loading />
      </MemoryRouter>
    );

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('applies card widget class', () => {
    renderWidgetWrapper();

    const wrapper = screen.getByTestId('widget-wrapper');

    expect(wrapper).toHaveClass('card-widget');
  });

  it('renders with multiple children elements', () => {
    const multipleChildren = (
      <div>
        <span>Child 1</span>
        <span>Child 2</span>
        <span>Child 3</span>
      </div>
    );

    renderWidgetWrapper({ children: multipleChildren });

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });
});
