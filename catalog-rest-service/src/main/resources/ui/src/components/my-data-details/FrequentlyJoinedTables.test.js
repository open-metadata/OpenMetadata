import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FrequentlyJoinedTables from './FrequentlyJoinedTables';

describe('Test QueryDetails Component', () => {
  it('Renders the proper header sent to the component', () => {
    const { container } = render(
      <FrequentlyJoinedTables
        header="Related Tables"
        tableList={['dim_customer', 'fact_sale', 'dim_product', 'dim_address']}
      />,
      { wrapper: MemoryRouter }
    );
    const header = getByTestId(container, 'related-tables-header');

    expect(header.textContent).toBe('Related Tables');
  });

  it('Renders the proper table list sent to the component', () => {
    const { container } = render(
      <FrequentlyJoinedTables
        header="Related Tables"
        tableList={['dim_customer', 'fact_sale', 'dim_product', 'dim_address']}
      />,
      { wrapper: MemoryRouter }
    );
    const tableData = getAllByTestId(container, 'related-tables-data');

    expect(tableData.length).toBe(4);
    expect(tableData.map((tableName) => tableName.textContent)).toStrictEqual([
      'dim_customer',
      'fact_sale',
      'dim_product',
      '+ 1 more',
    ]);
  });
});
