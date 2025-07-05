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
  skeletonContainerStyle: { marginLeft: '20px', marginTop: '20px' },
  className: 'custom-wrapper-class',
  dataTestId: 'test-widget-wrapper',
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

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
    // EntityListSkeleton should be rendered when loading is true
    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWidgetWrapper();

    const wrapper = screen.getByTestId('test-widget-wrapper');

    expect(wrapper).toHaveClass('custom-wrapper-class');
  });

  it('renders with custom data test id', () => {
    renderWidgetWrapper({ dataTestId: 'custom-wrapper' });

    expect(screen.getByTestId('custom-wrapper')).toBeInTheDocument();
  });

  it('renders with default props', () => {
    renderWidgetWrapper({
      children: <div>Default Content</div>,
      loading: undefined,
      dataLength: undefined,
      skeletonContainerStyle: undefined,
      className: undefined,
      dataTestId: undefined,
    });

    expect(screen.getByText('Default Content')).toBeInTheDocument();
    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('renders with custom data length', () => {
    renderWidgetWrapper({ dataLength: 10 });

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
  });

  it('renders with custom skeleton container style', () => {
    const customStyle = { marginLeft: '30px', marginTop: '30px' };
    renderWidgetWrapper({ skeletonContainerStyle: customStyle });

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
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

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
  });

  it('renders with different loading states', () => {
    const { rerender } = renderWidgetWrapper({ loading: false });

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <WidgetWrapper {...mockProps} loading />
      </MemoryRouter>
    );

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
  });

  it('renders with different data lengths', () => {
    renderWidgetWrapper({ dataLength: 3 });

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();

    renderWidgetWrapper({ dataLength: 7 });

    expect(screen.getByTestId('test-widget-wrapper')).toBeInTheDocument();
  });

  it('applies card widget class', () => {
    renderWidgetWrapper();

    const wrapper = screen.getByTestId('test-widget-wrapper');

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
