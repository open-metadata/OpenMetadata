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

import { fireEvent, render, screen } from '@testing-library/react';
import { TagOption } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Column } from '../../generated/api/data/createTable';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Table } from '../../generated/entity/data/table';
import EntityTableV1 from './EntityTable.component';

const onEntityFieldSelect = jest.fn();
const onThreadLinkSelect = jest.fn();

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
    {
      name: 'store_address',
      dataType: 'ARRAY',
      arrayDataType: 'STRUCT',
      dataLength: 1,
      dataTypeDisplay:
        'array<struct<name:character varying(32),street_address:character varying(128),city:character varying(32),postcode:character varying(8)>>',
      fullyQualifiedName:
        'bigquery_gcp.ecommerce.shopify.raw_product_catalog.store_address',
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
        'bigquery_gcp.ecommerce.shopify.raw_product_catalog.first_order_date',
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
        'bigquery_gcp.ecommerce.shopify.raw_product_catalog.last_order_date',
      tags: [],
      ordinalPosition: 6,
    },
  ] as Column[],
  searchText: '',
  hasEditAccess: false,
  joins: [],
  entityFieldThreads: [],
  isReadOnly: false,
  entityFqn: 'bigquery_gcp.ecommerce.shopify.raw_product_catalog',
  owner: {} as Table['owner'],
  columnName: '',
  tableConstraints: mockTableConstraints,
  onEntityFieldSelect,
  onThreadLinkSelect,
};

const mockTagList = [
  {
    id: 'tagCatId1',
    name: 'TagCat1',
    description: '',
    children: [
      {
        id: 'tagId1',
        name: 'Tag1',
        fullyQualifiedName: 'TagCat1.Tag1',
        description: '',
        deprecated: false,
        deleted: false,
      },
    ],
  },
  {
    id: 'tagCatId2',
    name: 'TagCat2',
    description: '',
    children: [
      {
        id: 'tagId2',
        name: 'Tag2',
        fullyQualifiedName: 'TagCat2.Tag2',
        description: '',
        deprecated: false,
        deleted: false,
      },
    ],
  },
];

const mockGlossaryList = [
  {
    name: 'Tag1',
    displayName: 'Tag1',
    fullyQualifiedName: 'Glossary.Tag1',
    type: 'glossaryTerm',
    id: 'glossaryTagId1',
  },
  {
    name: 'Tag2',
    displayName: 'Tag2',
    fullyQualifiedName: 'Glossary.Tag2',
    type: 'glossaryTerm',
    id: 'glossaryTagId2',
  },
];

jest.mock('../../hooks/authHooks', () => {
  return {
    useAuth: jest.fn().mockReturnValue({
      userPermissions: jest.fn().mockReturnValue(true),
      isAdminUser: true,
    }),
  };
});

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: jest.fn().mockReturnValue(<i>Icon</i>),
}));

jest.mock('@fortawesome/free-solid-svg-icons', () => ({
  faCaretDown: jest.fn().mockReturnValue(<i>faCaretDown</i>),
  faCaretRight: jest.fn().mockReturnValue(<i>faCaretRight</i>),
}));

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor', () => ({
  ModalWithMarkdownEditor: jest.fn().mockReturnValue(<p>EditorModal</p>),
}));

jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockImplementation(({ tagList }) => {
    return (
      <>
        {tagList.map((tag: TagOption, idx: number) => (
          <p key={idx}>{tag.fqn}</p>
        ))}
      </>
    );
  });
});

jest.mock('components/Tag/TagsViewer/tags-viewer', () => {
  return jest.fn().mockReturnValue(<p>TagViewer</p>);
});

jest.mock('components/Tag/Tags/tags', () => {
  return jest.fn().mockReturnValue(<p>Tag</p>);
});

jest.mock('../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(() => Promise.resolve(mockGlossaryList)),
  getGlossaryTermlist: jest.fn((terms) => {
    return terms.map((term: GlossaryTerm) => term?.fullyQualifiedName);
  }),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getClassifications: jest.fn(() => Promise.resolve({ data: mockTagList })),
}));

describe('Test EntityTable Component', () => {
  it('Initially, Table should load', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await screen.findByTestId('entity-table');

    expect(entityTable).toBeInTheDocument();
  });

  it('should render request description button', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await screen.findByTestId('entity-table');

    expect(entityTable).toBeInTheDocument();

    const requestDescriptionButton = await screen.findAllByTestId(
      'request-description'
    );

    expect(requestDescriptionButton[0]).toBeInTheDocument();
  });

  it('Should render start thread button', async () => {
    render(<EntityTableV1 {...mockEntityTableProp} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = await screen.findByTestId('entity-table');

    expect(entityTable).toBeInTheDocument();

    const startThreadButton = await screen.findAllByTestId(
      'start-field-thread'
    );

    expect(startThreadButton[0]).toBeInTheDocument();

    fireEvent.click(
      startThreadButton[0],
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(onThreadLinkSelect).toHaveBeenCalled();
  });
});
