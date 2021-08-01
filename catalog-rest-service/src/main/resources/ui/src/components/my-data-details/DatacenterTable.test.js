import { render } from '@testing-library/react';
import React from 'react';
import { qualityDetails } from '../../pages/my-data-details/index.mock';
import DatacenterTable from './DatacenterTable';

describe('Test DatacenterTable Component', () => {
  const { datacenterDetails } = qualityDetails;

  it('Renders all the datacenter details sent to the component', () => {
    const { getAllByTestId } = render(
      <DatacenterTable datacenterDetails={datacenterDetails} />
    );
    const datacenters = getAllByTestId('datacenter');

    expect(datacenters.length).toBe(3);
  });
});
