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
  getAllByTestId,
  getByTestId,
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
});
