/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  findAllByTestId,
  findByTestId,
  fireEvent,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Table } from '../../generated/entity/data/table';
import { ModifiedTableColumn } from '../../interface/dataQuality.interface';
import EntityTable from './EntityTable.component';

const mockTableheader = [
  {
    Header: 'Name',
    accessor: 'name',
  },
  {
    Header: 'Type',
    accessor: 'dataTypeDisplay',
  },
  {
    Header: 'Data Quality',
    accessor: 'columnTests',
  },
  {
    Header: 'Description',
    accessor: 'description',
  },
  {
    Header: 'Tags',
    accessor: 'tags',
  },
];

const mockEntityFieldThreads = [
  {
    entityLink:
      '<#E/table/bigquery_gcp.shopify.raw_product_catalog/columns/products/description>',
    count: 1,
    entityField: 'columns/products/description',
  },
];

const onEntityFieldSelect = jest.fn();
const onThreadLinkSelect = jest.fn();

const mockEntityTableProp = {
  tableColumns: [
    {
      name: 'comments',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName: 'bigquery_gcp.shopify.raw_product_catalog.comments',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 1,
    },
    {
      name: 'products',
      dataType: 'ARRAY',
      arrayDataType: 'STRUCT',
      dataLength: 1,
      dataTypeDisplay:
        'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64), stock:int>>',
      fullyQualifiedName: 'bigquery_gcp.shopify.raw_product_catalog.products',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 2,
    },
    {
      name: 'platform',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName: 'bigquery_gcp.shopify.raw_product_catalog.platform',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 3,
    },
    {
      name: 'store_address',
      dataType: 'ARRAY',
      arrayDataType: 'STRUCT',
      dataLength: 1,
      dataTypeDisplay:
        'array<struct<name:character varying(32),street_address:character varying(128),city:character varying(32),postcode:character varying(8)>>',
      fullyQualifiedName:
        'bigquery_gcp.shopify.raw_product_catalog.store_address',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 4,
    },
    {
      name: 'first_order_date',
      dataType: 'TIMESTAMP',
      dataTypeDisplay: 'timestamp',
      description:
        'The date (ISO 8601) and time (UTC) when the customer placed their first order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      fullyQualifiedName:
        'bigquery_gcp.shopify.raw_product_catalog.first_order_date',
      tags: [],
      ordinalPosition: 5,
    },
    {
      name: 'last_order_date',
      dataType: 'TIMESTAMP',
      dataTypeDisplay: 'timestamp',
      description:
        'The date (ISO 8601) and time (UTC) when the customer placed their most recent order. The format is YYYY-MM-DD HH:mm:ss (for example, 2016-02-05 17:04:01).',
      fullyQualifiedName:
        'bigquery_gcp.shopify.raw_product_catalog.last_order_date',
      tags: [],
      ordinalPosition: 6,
    },
  ] as ModifiedTableColumn[],
  searchText: '',
  hasEditAccess: false,
  joins: [],
  entityFieldThreads: [],
  isReadOnly: false,
  entityFqn: 'bigquery_gcp.shopify.raw_product_catalog',
  owner: {} as Table['owner'],
  columnName: '',
  onEntityFieldSelect,
  onThreadLinkSelect,
};

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: jest.fn().mockReturnValue(<i>Icon</i>),
}));

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest.fn().mockReturnValue(<p>NonAdminAction</p>);
});

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});
jest.mock('../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor', () => ({
  ModalWithMarkdownEditor: jest.fn().mockReturnValue(<p>EditorModal</p>),
}));
jest.mock('../tags-container/tags-container', () => {
  return jest.fn().mockReturnValue(<p>TagContainer</p>);
});
jest.mock('../tags-viewer/tags-viewer', () => {
  return jest.fn().mockReturnValue(<p>TagViewer</p>);
});
jest.mock('../tags/tags', () => {
  return jest.fn().mockReturnValue(<p>Tag</p>);
});

describe('Test EntityTable Component', () => {
  it('Check if it has all child elements', async () => {
    const { container } = render(<EntityTable {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await findByTestId(container, 'entity-table');

    expect(entityTable).toBeInTheDocument();

    const tableHeader = await findByTestId(container, 'table-header');

    expect(tableHeader).toBeInTheDocument();

    for (let index = 0; index < mockTableheader.length; index++) {
      const headerValue = mockTableheader[index];

      const header = await findByTestId(tableHeader, `${headerValue.accessor}`);

      expect(header).toBeInTheDocument();
    }

    const tableBody = await findByTestId(container, 'table-body');

    expect(tableBody).toBeInTheDocument();

    const tableRows = await findAllByTestId(tableBody, 'row');

    expect(tableRows).toHaveLength(mockEntityTableProp.tableColumns.length);
  });

  it('should render request description button', async () => {
    const { container } = render(<EntityTable {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await findByTestId(container, 'entity-table');

    expect(entityTable).toBeInTheDocument();

    const tableBody = await findByTestId(container, 'table-body');

    expect(tableBody).toBeInTheDocument();

    const tableRows = await findAllByTestId(tableBody, 'row');

    const requestDescriptionButton = await findByTestId(
      tableRows[0],
      'request-description'
    );

    expect(requestDescriptionButton).toBeInTheDocument();

    fireEvent.click(
      requestDescriptionButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(onEntityFieldSelect).toBeCalled();

    const descriptionThread = queryByTestId(tableRows[0], 'field-thread');
    const startDescriptionThread = queryByTestId(
      tableRows[0],
      'start-field-thread'
    );

    // should not be in the document, as request description button is present
    expect(descriptionThread).not.toBeInTheDocument();
    expect(startDescriptionThread).not.toBeInTheDocument();
  });

  it('Should render start thread button', async () => {
    const { container } = render(<EntityTable {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await findByTestId(container, 'entity-table');

    expect(entityTable).toBeInTheDocument();

    const tableBody = await findByTestId(container, 'table-body');

    expect(tableBody).toBeInTheDocument();

    const tableRows = await findAllByTestId(tableBody, 'row');

    const startThreadButton = await findByTestId(
      tableRows[4],
      'start-field-thread'
    );

    expect(startThreadButton).toBeInTheDocument();

    fireEvent.click(
      startThreadButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(onThreadLinkSelect).toBeCalled();
  });

  it('Should render thread button with count', async () => {
    const { container } = render(
      <EntityTable
        {...mockEntityTableProp}
        entityFieldThreads={mockEntityFieldThreads}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityTable = await findByTestId(container, 'entity-table');

    expect(entityTable).toBeInTheDocument();

    const tableBody = await findByTestId(container, 'table-body');

    expect(tableBody).toBeInTheDocument();

    const tableRows = await findAllByTestId(tableBody, 'row');

    const threadButton = await findByTestId(tableRows[1], 'field-thread');

    expect(threadButton).toBeInTheDocument();

    fireEvent.click(
      threadButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(onThreadLinkSelect).toBeCalled();

    const threadCount = await findByTestId(threadButton, 'field-thread-count');

    expect(threadCount).toBeInTheDocument();

    expect(threadCount).toHaveTextContent(
      String(mockEntityFieldThreads[0].count)
    );
  });
});
