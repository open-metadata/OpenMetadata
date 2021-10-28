import { getByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import DashboardDetailsPage from './DashboardDetailsPage.component';

jest.mock('./DashboardDetailsPage.component', () => {
  return jest.fn().mockReturnValue(<div>DashboardDetails Page</div>);
});

describe('Test DashboardDetails page', () => {
  it('Component should render', async () => {
    const { container } = render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = getByText(container, 'DashboardDetails Page');

    expect(ContainerText).toBeInTheDocument();
  });
});
