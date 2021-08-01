import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { queryDetailsData } from '../../pages/my-data/index.mock';
import QueryDetails from './QueryDetails';

describe('Test QueryDetails Component', () => {
  const { testdata1, testdata2 } = queryDetailsData;

  it('Renders the proper HTML when there are no query tags', () => {
    const { queryByTestId, container } = render(
      <QueryDetails queryDetails={testdata1} />
    );

    expect(queryByTestId('tag')).toBeNull();

    const runDetailsElement = getByTestId(container, 'run-details');
    const rowCountElement = getByTestId(container, 'row-count');
    const colCountElement = getByTestId(container, 'col-count');
    const dataTypeCountElement = getByTestId(container, 'datatype-count');

    expect(runDetailsElement.textContent).toBe('Suresh on Jan 15, 2019 1:25pm');
    expect(rowCountElement.textContent).toBe('1454');
    expect(colCountElement.textContent).toBe('15');
    expect(dataTypeCountElement.textContent).toBe('3');
  });

  it('Renders the proper HTML for multiple query tags', () => {
    const { getAllByTestId, container } = render(
      <QueryDetails queryDetails={testdata2} />
    );
    const tagList = getAllByTestId('query-tag');

    expect(tagList.length).toBe(3);

    const runDetailsElement = getByTestId(container, 'run-details');
    const rowCountElement = getByTestId(container, 'row-count');
    const colCountElement = getByTestId(container, 'col-count');
    const dataTypeCountElement = getByTestId(container, 'datatype-count');

    expect(runDetailsElement.textContent).toBe('Harsha on Jan 25, 2020 3:45am');
    expect(rowCountElement.textContent).toBe('1234');
    expect(colCountElement.textContent).toBe('54');
    expect(dataTypeCountElement.textContent).toBe('7');
  });
});
