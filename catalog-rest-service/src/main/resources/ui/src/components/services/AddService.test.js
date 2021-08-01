import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import mockData from '../../pages/services/index.mock';
import AddServiceModal from './AddService';

describe('Test Add Service Modal Component', () => {
  it('Renders the proper HTML for add servie form', () => {
    const handleSave = jest.fn();
    const { container } = render(
      <AddServiceModal handleSave={handleSave} serviceCollection={mockData} />
    );
    const element = getByTestId(container, 'form');

    expect(element).toBeInTheDocument();
  });
});
