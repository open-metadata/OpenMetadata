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
import PageLayoutV2 from './PageLayoutV2.component';

// Mock the hooks and components
jest.mock('../../hooks/useAlertStore', () => ({
  useAlertStore: jest.fn(() => ({
    alert: null,
  })),
}));

jest.mock('../AlertBar/AlertBar', () => {
  return jest.fn(() => <div data-testid="alert-bar">Alert Bar</div>);
});

jest.mock('../common/DocumentTitle/DocumentTitle', () => {
  return jest.fn(() => <div data-testid="document-title">Document Title</div>);
});

import { useAlertStore } from '../../hooks/useAlertStore';

const mockUseAlertStore = useAlertStore as jest.MockedFunction<
  typeof useAlertStore
>;

const renderPageLayoutV2 = (props = {}) => {
  const defaultProps = {
    pageTitle: 'Test Page',
    children: <div data-testid="page-content">Page Content</div>,
    ...props,
  };

  return render(
    <MemoryRouter>
      <PageLayoutV2 {...defaultProps} />
    </MemoryRouter>
  );
};

describe('PageLayoutV2', () => {
  beforeEach(() => {
    mockUseAlertStore.mockReturnValue({
      alert: null,
    });
  });

  it('should render the component with basic props', () => {
    renderPageLayoutV2();

    expect(screen.getByTestId('page-layout-v2')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByTestId('document-title')).toBeInTheDocument();
  });

  it('should render breadcrumbs when provided', () => {
    const breadcrumbs = [
      { label: 'Home', path: '/' },
      { label: 'Domains', path: '/domains' },
      { label: 'Current Page' },
    ];

    renderPageLayoutV2({ breadcrumbs });

    // First breadcrumb (Home) is rendered as an icon, so we check for the link instead
    expect(screen.getByRole('link', { name: '' })).toBeInTheDocument();
    expect(screen.getByText('Domains')).toBeInTheDocument();
    expect(screen.getByText('Current Page')).toBeInTheDocument();
  });

  it('should render header when provided', () => {
    const header = <div data-testid="page-header">Page Header</div>;

    renderPageLayoutV2({ header });

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
  });

  it('should render alert when present', () => {
    mockUseAlertStore.mockReturnValue({
      alert: {
        message: 'Test alert message',
        type: 'info',
      },
    });

    renderPageLayoutV2();

    expect(screen.getByTestId('alert-bar')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    renderPageLayoutV2({ className: 'custom-class' });

    expect(screen.getByTestId('page-layout-v2')).toHaveClass('custom-class');
  });

  it('should apply custom style', () => {
    const customStyle = { backgroundColor: 'red' };

    renderPageLayoutV2({ style: customStyle });

    expect(screen.getByTestId('page-layout-v2')).toHaveStyle(customStyle);
  });

  it('should not render breadcrumbs when empty array is provided', () => {
    renderPageLayoutV2({ breadcrumbs: [] });

    const breadcrumbContainer = screen
      .getByTestId('page-layout-v2')
      .querySelector('.page-layout-v2-breadcrumbs');

    expect(breadcrumbContainer).not.toBeInTheDocument();
  });

  it('should not render header when not provided', () => {
    renderPageLayoutV2();

    const headerContainer = screen
      .getByTestId('page-layout-v2')
      .querySelector('.page-layout-v2-header');

    expect(headerContainer).not.toBeInTheDocument();
  });

  it('should not render right panel when not provided', () => {
    renderPageLayoutV2();

    const rightPanelContainer = screen
      .getByTestId('page-layout-v2')
      .querySelector('.page-layout-v2-right-panel');

    expect(rightPanelContainer).not.toBeInTheDocument();
  });
});
