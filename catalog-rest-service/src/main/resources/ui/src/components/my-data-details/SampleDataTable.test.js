import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import { schemaDetails } from '../../pages/my-data-details/index.mock';
import SampleDataTable from './SampleDataTable';

describe('Test SampleDataTable Component', () => {
  it('Renders all the data that was sent to the component', () => {
    const { container } = render(
      <SampleDataTable
        columns={schemaDetails.columns}
        data={schemaDetails.data}
      />
    );
    const columns = getAllByTestId(container, 'column-name');

    expect(columns.length).toBe(18);

    const rows = getAllByTestId(container, 'row');

    expect(rows.length).toBe(19);

    const cells = getAllByTestId(container, 'cell');

    expect(cells.length).toBe(342);
  });

  it('Renders only data for the columns that was passed', () => {
    const { container } = render(
      <SampleDataTable
        columns={schemaDetails.columns.slice(0, 5)}
        data={schemaDetails.data}
      />
    );
    const columns = getAllByTestId(container, 'column-name');

    expect(columns.length).toBe(5);

    const rows = getAllByTestId(container, 'row');

    expect(rows.length).toBe(19);

    const cells = getAllByTestId(container, 'cell');

    expect(cells.length).toBe(95);
  });

  it('Renders no data if the columns passed are empty', () => {
    const { queryByTestId } = render(
      <SampleDataTable columns={[]} data={schemaDetails.data} />
    );

    expect(queryByTestId('column-name')).toBeNull();
    expect(queryByTestId('cell')).toBeNull();
  });
});
