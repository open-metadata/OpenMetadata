/*
 *  Copyright 2022 Collate.
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

import {
  fireEvent,
  getAllByTestId,
  getByTestId,
  queryByTestId,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TitleBreadcrumb from './TitleBreadcrumb.component';

describe('Test Breadcrumb Component', () => {
  const links = [
    {
      name: 'home',
      url: '/',
    },
    {
      name: 'services',
      url: '/services',
    },
    {
      name: 'database',
      url: '',
    },
  ];

  it('Component should render', () => {
    const { getByTestId } = render(
      <TitleBreadcrumb className="test" titleLinks={links} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const breadcrumb = getByTestId('breadcrumb');

    expect(breadcrumb).toBeInTheDocument();

    expect(breadcrumb).toHaveClass('test');
  });

  it('Number of link shoub be equal to value provided', () => {
    const { container } = render(<TitleBreadcrumb titleLinks={links} />, {
      wrapper: MemoryRouter,
    });
    const breadcrumbLink = getAllByTestId(container, 'breadcrumb-link');

    expect(breadcrumbLink).toHaveLength(3);
  });

  it('Last value should not be link', () => {
    const { container } = render(<TitleBreadcrumb titleLinks={links} />, {
      wrapper: MemoryRouter,
    });
    const lastLink = getByTestId(container, 'inactive-link');

    expect(lastLink).not.toHaveAttribute('href');

    expect(lastLink).toHaveClass('cursor-text');
  });

  it('Should work if link object is provided', () => {
    const links = [
      {
        name: 'home',
        url: '/',
      },
      {
        name: 'services',
        url: {
          pathname: '/services',
        },
      },
      {
        name: 'database',
        url: '',
      },
    ];

    render(<TitleBreadcrumb titleLinks={links} />, {
      wrapper: MemoryRouter,
    });

    const serviceLink = screen.getByText('services');

    expect(serviceLink).toHaveAttribute('href', '/services');
  });

  describe('Smart breadcrumb (maxVisible collapse)', () => {
    const deepLinks = [
      { name: 'home', url: '/' },
      { name: 'services', url: '/services' },
      { name: 'snowflake', url: '/services/snowflake' },
      { name: 'analytics', url: '/services/snowflake/analytics' },
      { name: 'customers', url: '/services/snowflake/analytics/customers' },
      { name: 'orders', url: '' },
    ];

    it('Collapses middle segments to an ellipsis chip past 3 levels', () => {
      const { container } = render(<TitleBreadcrumb titleLinks={deepLinks} />, {
        wrapper: MemoryRouter,
      });

      const chip = getByTestId(container, 'breadcrumb-ellipsis');
      const visibleLinks = getAllByTestId(container, 'breadcrumb-link');

      expect(chip).toBeInTheDocument();
      expect(visibleLinks).toHaveLength(3);
      expect(visibleLinks[0]).toHaveTextContent('home');
      expect(visibleLinks[1]).toHaveTextContent('customers');
      expect(visibleLinks[2]).toHaveTextContent('orders');
    });

    it('Expands the collapsed segments when the ellipsis chip is clicked', () => {
      const { container } = render(<TitleBreadcrumb titleLinks={deepLinks} />, {
        wrapper: MemoryRouter,
      });

      const chipButton = getByTestId(container, 'breadcrumb-ellipsis-button');
      fireEvent.click(chipButton);

      const visibleLinks = getAllByTestId(container, 'breadcrumb-link');

      expect(visibleLinks).toHaveLength(deepLinks.length);
      expect(queryByTestId(container, 'breadcrumb-ellipsis')).toBeNull();
    });

    it('Does not collapse when titleLinks fits within maxVisible', () => {
      const { container } = render(<TitleBreadcrumb titleLinks={links} />, {
        wrapper: MemoryRouter,
      });

      expect(queryByTestId(container, 'breadcrumb-ellipsis')).toBeNull();
    });

    it('Respects custom maxVisible prop', () => {
      const fourLinks = deepLinks.slice(0, 4);
      const { container } = render(
        <TitleBreadcrumb maxVisible={4} titleLinks={fourLinks} />,
        {
          wrapper: MemoryRouter,
        }
      );

      expect(queryByTestId(container, 'breadcrumb-ellipsis')).toBeNull();
      expect(getAllByTestId(container, 'breadcrumb-link')).toHaveLength(4);
    });
  });
});
