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
import { BrowserRouter } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { Breadcrumb } from './Breadcrumb.component';
import { TitleLink } from './Breadcrumb.interface';

const mockBreadcrumbItems: TitleLink[] = [
  {
    name: 'Domains',
    url: ROUTES.DOMAINS,
  },
  {
    name: 'Engineering Domain',
    url: '/domains/engineering',
  },
  {
    name: 'Data Products',
    url: '/data-products',
    activeTitle: true,
  },
];

const renderBreadcrumb = (props = {}) => {
  const defaultProps = {
    titleLinks: mockBreadcrumbItems,
  };

  return render(
    <BrowserRouter>
      <Breadcrumb {...defaultProps} {...props} />
    </BrowserRouter>
  );
};

describe('Breadcrumb Component', () => {
  it('should render breadcrumb navigation', () => {
    renderBreadcrumb();

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('should render home icon by default', () => {
    renderBreadcrumb();

    expect(screen.getByTestId('breadcrumb-home')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb-home')).toHaveAttribute(
      'href',
      ROUTES.MY_DATA
    );
  });

  it('should not render home icon when showHomeIcon is false', () => {
    renderBreadcrumb({ showHomeIcon: false });

    expect(screen.queryByTestId('breadcrumb-home')).not.toBeInTheDocument();
  });

  it('should render all breadcrumb items', () => {
    renderBreadcrumb();

    expect(screen.getByText('Domains')).toBeInTheDocument();
    expect(screen.getByText('Engineering Domain')).toBeInTheDocument();
    expect(screen.getByText('Data Products')).toBeInTheDocument();
  });

  it('should render links for non-last items', () => {
    renderBreadcrumb();

    const domainsLink = screen.getByRole('link', { name: 'Domains' });

    expect(domainsLink).toHaveAttribute('href', ROUTES.DOMAINS);

    const engineeringLink = screen.getByRole('link', {
      name: 'Engineering Domain',
    });

    expect(engineeringLink).toHaveAttribute('href', '/domains/engineering');
  });

  it('should render last item without link (inactive)', () => {
    renderBreadcrumb();

    const lastItem = screen.getByTestId('inactive-link');

    expect(lastItem).toBeInTheDocument();
    expect(lastItem).toHaveTextContent('Data Products');
  });

  it('should render separators between items', () => {
    renderBreadcrumb();

    const separators = screen.getAllByTestId('breadcrumb-separator');

    // Home + 3 items = 3 separators (between home-item1, item1-item2, item2-item3)
    expect(separators).toHaveLength(3);

    separators.forEach((separator) => {
      expect(separator).toHaveTextContent('>');
    });
  });

  it('should render custom separator', () => {
    renderBreadcrumb({ separator: '/' });

    const separators = screen.getAllByTestId('breadcrumb-separator');
    separators.forEach((separator) => {
      expect(separator).toHaveTextContent('/');
    });
  });

  it('should apply custom className', () => {
    renderBreadcrumb({ className: 'custom-breadcrumb' });

    expect(screen.getByTestId('breadcrumb')).toHaveClass('custom-breadcrumb');
  });

  it('should use custom data-testid', () => {
    renderBreadcrumb({ 'data-testid': 'custom-breadcrumb-test' });

    expect(screen.getByTestId('custom-breadcrumb-test')).toBeInTheDocument();
    expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
  });

  it('should render empty breadcrumb with only home icon', () => {
    renderBreadcrumb({ titleLinks: [] });

    expect(screen.getByTestId('breadcrumb-home')).toBeInTheDocument();
    expect(
      screen.queryByTestId('breadcrumb-separator')
    ).not.toBeInTheDocument();
  });

  it('should handle items with imgSrc', () => {
    const itemsWithImages: TitleLink[] = [
      {
        name: 'Item with Image',
        url: '/test',
        imgSrc: 'test-image.png',
      },
    ];

    renderBreadcrumb({ titleLinks: itemsWithImages });

    const image = screen.getByRole('img');

    expect(image).toHaveAttribute('src', 'test-image.png');
  });

  it('should handle activeTitle properly', () => {
    const itemsWithActiveTitle: TitleLink[] = [
      {
        name: 'Regular Item',
        url: '/test',
      },
      {
        name: 'Active Item',
        url: '/active',
        activeTitle: true,
      },
    ];

    renderBreadcrumb({ titleLinks: itemsWithActiveTitle });

    expect(screen.getByTestId('inactive-link')).toHaveTextContent(
      'Active Item'
    );
  });
});
