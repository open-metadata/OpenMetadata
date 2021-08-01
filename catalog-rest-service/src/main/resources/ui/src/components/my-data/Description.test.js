import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { descriptionData } from '../../pages/my-data/index.mock';
import Description from './Description';

describe('Test Description Component', () => {
  const { testdata1, testdata2 } = descriptionData;

  it('Renders the proper HTML for description and misc details', () => {
    const { description, miscDetails } = testdata1;
    const { container } = render(
      <Description description={description} miscDetails={miscDetails} />
    );
    const descriptionElement = getByTestId(container, 'description');
    const miscElements = getAllByTestId(container, 'misc-details');

    expect(descriptionElement.textContent).toBe(
      'Metric to determine rate of checkouts across the marketplace'
    );
    expect(miscElements.length).toBe(5);
  });

  it('Renders the proper HTML for description and no misc details', () => {
    const { description, miscDetails } = testdata2;
    const { queryByTestId, container } = render(
      <Description description={description} miscDetails={miscDetails} />
    );

    expect(queryByTestId('misc-details-container')).toBeNull();

    const descriptionElement = getByTestId(container, 'description');

    expect(descriptionElement.textContent).toBe(
      'Dashboard captures the top selling products across the marketplace per hour'
    );
  });

  it('Renders the proper HTML for default data', () => {
    const { queryByTestId, container } = render(<Description description="" />);

    expect(queryByTestId('misc-details-container')).toBeNull();

    const descriptionElement = getByTestId(container, 'description');

    expect(descriptionElement.textContent).toBe('');
  });
});
