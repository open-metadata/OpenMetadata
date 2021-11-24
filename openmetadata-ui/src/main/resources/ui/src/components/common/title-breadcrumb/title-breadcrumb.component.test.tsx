import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TitleBreadcrumb from './title-breadcrumb.component';

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

    expect(breadcrumbLink.length).toBe(3);
  });

  it('Last value should not be link', () => {
    const { container } = render(<TitleBreadcrumb titleLinks={links} />, {
      wrapper: MemoryRouter,
    });
    const lastLink = getByTestId(container, 'inactive-link');

    expect(lastLink).not.toHaveAttribute('href');

    expect(lastLink).toHaveClass('tw-cursor-text');
  });
});
