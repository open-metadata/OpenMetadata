import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import { schemaDetails } from '../../pages/my-data-details/index.mock';
import SchemaTable from './SchemaTable';

describe('Test QueryDetails Component', () => {
  it('Renders all the columns sent to the component', () => {
    const { container } = render(
      <SchemaTable columns={schemaDetails.columns} />
    );
    const columns = getAllByTestId(container, 'column');

    expect(columns.length).toBe(18);
  });
});
