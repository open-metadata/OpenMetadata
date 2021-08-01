import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import QualityTab from './QualityTab';

describe('Test QualityTab Component', () => {
  it('Renders all the components to be present in the tab', () => {
    const { container } = render(<QualityTab />);
    const addTestButton = getByTestId(container, 'add-test-button');

    expect(addTestButton).toBeInTheDocument();

    const qualityCards = getAllByTestId(container, 'quality-card-container');

    expect(qualityCards.length).toBe(3);

    const datacenterTable = getByTestId(
      container,
      'datacenter-details-container'
    );

    expect(datacenterTable).toBeInTheDocument();

    const testsTable = getByTestId(container, 'tests-details-container');

    expect(testsTable).toBeInTheDocument();
  });
});
