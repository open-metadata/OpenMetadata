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
import { flatten } from 'lodash';
import { FormattedGlossaryTermData, TagOption } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Table } from '../../generated/entity/data/table';
import { TagCategory, TagClass } from '../../generated/entity/tags/tagCategory';
import { ModifiedTableColumn } from '../../interface/dataQuality.interface';
import { fetchGlossaryTerms } from '../../utils/GlossaryUtils';
import { getTagCategories } from '../../utils/TagsUtils';
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
      '<#E::table::bigquery_gcp.ecommerce.shopify.raw_product_catalog::columns::products::description>',
    count: 1,
    entityField: 'columns::products::description',
  },
];

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
  ] as ModifiedTableColumn[],
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
    categoryType: 'Classification',
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
    categoryType: 'Classification',
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

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
    })),
  };
});

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

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <p data-testid="tag-action">{children}</p>
    ));
});

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});
jest.mock('../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor', () => ({
  ModalWithMarkdownEditor: jest.fn().mockReturnValue(<p>EditorModal</p>),
}));
jest.mock('../tags-container/tags-container', () => {
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
jest.mock('../tags-viewer/tags-viewer', () => {
  return jest.fn().mockReturnValue(<p>TagViewer</p>);
});
jest.mock('../tags/tags', () => {
  return jest.fn().mockReturnValue(<p>Tag</p>);
});

jest.mock('../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(() => Promise.resolve(mockGlossaryList)),
  getGlossaryTermlist: jest.fn((terms) => {
    return terms.map(
      (term: FormattedGlossaryTermData) => term?.fullyQualifiedName
    );
  }),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getTagCategories: jest.fn(() => Promise.resolve({ data: mockTagList })),
  getTaglist: jest.fn((categories) => {
    const children = categories.map((category: TagCategory) => {
      return category.children || [];
    });
    const allChildren = flatten(children);
    const tagList = (allChildren as unknown as TagClass[]).map((tag) => {
      return tag?.fullyQualifiedName || '';
    });

    return tagList;
  }),
}));

jest.mock('./EntityTable.constant', () => ({
  TABLE_HEADERS: [...mockTableheader],
}));

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

  it('Check if tags and glossary-terms are present', async () => {
    const { getAllByTestId, findAllByText } = render(
      <EntityTable {...mockEntityTableProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getAllByTestId('tags-wrapper')[0];
    fireEvent.click(tagWrapper);

    const tag1 = await findAllByText('TagCat1.Tag1');
    const glossaryTerm1 = await findAllByText('Glossary.Tag1');

    expect(tag1).toHaveLength(mockEntityTableProp.tableColumns.length);
    expect(glossaryTerm1).toHaveLength(mockEntityTableProp.tableColumns.length);
  });

  it('Check if only tags are present', async () => {
    (fetchGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { getAllByTestId, findAllByText, queryAllByText } = render(
      <EntityTable {...mockEntityTableProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getAllByTestId('tags-wrapper')[0];
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = await findAllByText('TagCat1.Tag1');
    const glossaryTerm1 = queryAllByText('Glossary.Tag1');

    expect(tag1).toHaveLength(mockEntityTableProp.tableColumns.length);
    expect(glossaryTerm1).toHaveLength(0);
  });

  it('Check if only glossary terms are present', async () => {
    (getTagCategories as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { getAllByTestId, findAllByText, queryAllByText } = render(
      <EntityTable {...mockEntityTableProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getAllByTestId('tags-wrapper')[0];
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = queryAllByText('TagCat1.Tag1');
    const glossaryTerm1 = await findAllByText('Glossary.Tag1');

    expect(tag1).toHaveLength(0);
    expect(glossaryTerm1).toHaveLength(mockEntityTableProp.tableColumns.length);
  });

  it('Check that tags and glossary terms are not present', async () => {
    (getTagCategories as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    (fetchGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { getAllByTestId, queryAllByText } = render(
      <EntityTable {...mockEntityTableProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getAllByTestId('tags-wrapper')[0];
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = queryAllByText('TagCat1.Tag1');
    const glossaryTerm1 = queryAllByText('Glossary.Tag1');

    expect(tag1).toHaveLength(0);
    expect(glossaryTerm1).toHaveLength(0);
  });
});
