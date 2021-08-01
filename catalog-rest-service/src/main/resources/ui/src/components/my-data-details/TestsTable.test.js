import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import { qualityDetails } from '../../pages/my-data-details/index.mock';
import TestsTable from './TestsTable';

describe('Test TestsTable Component', () => {
  const { testsDetails } = qualityDetails;

  it('Renders all the tests sent to the component', () => {
    const { container } = render(<TestsTable testsDetails={testsDetails} />);
    const tests = getAllByTestId(container, 'test');

    expect(tests.length).toBe(4);
  });
});
