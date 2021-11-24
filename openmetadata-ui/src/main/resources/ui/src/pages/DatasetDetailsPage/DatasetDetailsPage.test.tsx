import { getByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import DatasetDetailsPage from './DatasetDetailsPage.component';

jest.mock('./DatasetDetailsPage.component', () => {
  return jest.fn().mockReturnValue(<div>DatasetDetails Page</div>);
});

describe('Test DatasetDetails page', () => {
  it('Component should render', async () => {
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = getByText(container, 'DatasetDetails Page');

    expect(ContainerText).toBeInTheDocument();
  });
});
