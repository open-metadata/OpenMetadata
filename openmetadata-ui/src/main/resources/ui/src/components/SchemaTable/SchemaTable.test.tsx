/*
 *  Copyright 2022 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Column } from '../../generated/entity/data/container';
import { Table, TablePartition } from '../../generated/entity/data/table';
import EntityTableV1 from './SchemaTable.component';

const onEntityFieldSelect = jest.fn();
const onThreadLinkSelect = jest.fn();
const onUpdate = jest.fn();

const mockTableConstraints = [
  {
    constraintType: 'PRIMARY_KEY',
    columns: ['address_id', 'shop_id'],
  },
] as Table['tableConstraints'];

const mockEntityTableProp = {
  tableColumns: [
    {
      name: 'comments',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName:
        'bigquery_gcp.ecommerce.shopify.raw_product_catalog.comments',
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
      fullyQualifiedName:
        'bigquery_gcp.ecommerce.shopify.raw_product_catalog.products',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 2,
    },
    {
      name: 'platform',
      dataType: 'STRING',
      dataLength: 1,
      dataTypeDisplay: 'string',
      fullyQualifiedName:
        'bigquery_gcp.ecommerce.shopify.raw_product_catalog.platform',
      tags: [],
      constraint: 'NULL',
      ordinalPosition: 3,
    },
  ] as Column[],
  searchText: '',
  hasEditAccess: false,
  joins: [],
  entityFieldThreads: [],
  hasDescriptionEditAccess: true,
  isReadOnly: false,
  entityFqn: 'bigquery_gcp.ecommerce.shopify.raw_product_catalog',
  owner: {} as Table['owner'],
  columnName: '',
  hasTagEditAccess: true,
  tableConstraints: mockTableConstraints,
  tablePartitioned: {} as TablePartition,
  onEntityFieldSelect,
  onThreadLinkSelect,
  onUpdate,
};

const columnsWithDisplayName = [
  {
    name: 'comments',
    displayName: 'Comments',
    dataType: 'STRING',
    dataLength: 1,
    dataTypeDisplay: 'string',
    fullyQualifiedName:
      'bigquery_gcp.ecommerce.shopify.raw_product_catalog.comments',
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
    fullyQualifiedName:
      'bigquery_gcp.ecommerce.shopify.raw_product_catalog.products',
    tags: [],
    constraint: 'NULL',
    ordinalPosition: 2,
  },
  {
    name: 'platform',
    dataType: 'STRING',
    dataLength: 1,
    dataTypeDisplay: 'string',
    fullyQualifiedName:
      'bigquery_gcp.ecommerce.shopify.raw_product_catalog.platform',
    tags: [],
    constraint: 'NULL',
    ordinalPosition: 3,
  },
] as Column[];

jest.mock('../../hooks/authHooks', () => {
  return {
    useAuth: jest.fn().mockReturnValue({
      userPermissions: jest.fn().mockReturnValue(true),
      isAdminUser: true,
    }),
  };
});

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor', () => ({
  ModalWithMarkdownEditor: jest.fn().mockReturnValue(<p>EditorModal</p>),
}));

jest.mock(
  '../../components/common/error-with-placeholder/FilterTablePlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<p>FilterTablePlaceHolder</p>);
  }
);

jest.mock('../../utils/TagsUtils', () => ({
  getAllTagsList: jest.fn(() => Promise.resolve([])),
  getTagsHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  getGlossaryTermsList: jest.fn(() => Promise.resolve([])),
  getGlossaryTermHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../components/TableTags/TableTags.component', () => {
  return jest.fn().mockReturnValue(<p>TableTags</p>);
});

jest.mock(
  '../../components/TableDescription/TableDescription.component',
  () => {
    return jest.fn().mockReturnValue(<p>TableDescription</p>);
  }
);

const mockTableScrollValue = jest.fn();

jest.mock('../../constants/Table.constants', () => ({
  get TABLE_SCROLL_VALUE() {
    return mockTableScrollValue();
  },
}));

describe('Test EntityTable Component', () => {
  it('Initially, Table should load', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await screen.findByTestId('entity-table');

    screen.debug(entityTable);

    expect(entityTable).toBeInTheDocument();
  });

  it('Should render tags and description components', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const tableTags = screen.getAllByText('TableTags');

    expect(tableTags).toHaveLength(6);

    const tableDescription = screen.getAllByText('TableDescription');

    expect(tableDescription).toHaveLength(3);
  });

  it('Table should load empty when no data present', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} tableColumns={[]} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await screen.findByTestId('entity-table');

    expect(entityTable).toBeInTheDocument();

    const emptyPlaceholder = screen.getByText('FilterTablePlaceHolder');

    expect(emptyPlaceholder).toBeInTheDocument();
  });

  it('should render column name only if displayName is not present', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const columnNames = await screen.findAllByTestId('column-display-name');

    expect(columnNames).toHaveLength(3);

    expect(columnNames[0].textContent).toBe('comments');
    expect(columnNames[1].textContent).toBe('products');
    expect(columnNames[2].textContent).toBe('platform');
  });

  it('should render column name & displayName for column if both presents', async () => {
    render(
      <EntityTableV1
        {...mockEntityTableProp}
        tableColumns={[...columnsWithDisplayName]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const columnDisplayName = await screen.findAllByTestId(
      'column-display-name'
    );
    const columnName = await screen.findByTestId('column-name');

    expect(columnDisplayName[0]).toBeInTheDocument();
    expect(columnName).toBeInTheDocument();

    expect(columnDisplayName[0].textContent).toBe('Comments');
    expect(columnName.textContent).toBe('comments');
  });
});
