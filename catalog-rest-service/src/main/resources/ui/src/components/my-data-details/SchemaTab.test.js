import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { schemaDetails } from '../../pages/my-data-details/index.mock';
import SchemaTab from './SchemaTab';

describe('Test SchemaTab Component', () => {
  it('Renders all the parts of the schema tab', () => {
    const { queryByTestId, container } = render(
      <SchemaTab columns={schemaDetails.columns} data={schemaDetails.data} />
    );
    const searchBar = getByTestId(container, 'search-bar-container');

    expect(searchBar).toBeInTheDocument();

    const schemaToggle = getByTestId(container, 'schema-button');

    expect(schemaToggle).toBeInTheDocument();

    const sampleDataToggle = getByTestId(container, 'sample-data-button');

    expect(sampleDataToggle).toBeInTheDocument();

    const schemaTable = getByTestId(container, 'schema-table');

    expect(schemaTable).toBeInTheDocument();
    expect(queryByTestId('sample-data-table')).toBeNull();
  });

  it('Renders the sample data table when toggle is clicked', () => {
    const { queryByTestId, container } = render(
      <SchemaTab columns={schemaDetails.columns} data={schemaDetails.data} />
    );

    expect(queryByTestId('sample-data-table')).toBeNull();

    const sampleDataToggle = getByTestId(container, 'sample-data-button');
    fireEvent.click(sampleDataToggle);
    const sampleDataTable = getByTestId(container, 'sample-data-table');

    expect(sampleDataTable).toBeInTheDocument();
  });
});
