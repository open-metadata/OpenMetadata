import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import BreadcrumbsComponent from './Breadcrumbs';

describe('Test Breadcrumbs Component', () => {
  it('Breadcrumb path should render "My Data"', async () => {
    const { findByText } = render(
      <MemoryRouter initialEntries={[ROUTES.MY_DATA]}>
        <BreadcrumbsComponent />
      </MemoryRouter>
    );
    const myData = await findByText(/My Data/);

    expect(myData).toBeInTheDocument();
  });
});
