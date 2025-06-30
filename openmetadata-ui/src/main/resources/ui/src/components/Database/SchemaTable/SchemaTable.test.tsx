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

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Column } from '../../../generated/entity/data/container';
import { Table } from '../../../generated/entity/data/table';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import SchemaTable from './SchemaTable.component';

const mockTableConstraints = [
  {
    constraintType: 'PRIMARY_KEY',
    columns: ['address_id', 'shop_id'],
  },
] as Table['tableConstraints'];
const mockColumns = [
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
] as Column[];

const mockGenericContextProps = {
  data: {
    ...MOCK_TABLE,
    columns: mockColumns,
    tableConstraints: mockTableConstraints,
  } as Table,
  permissions: DEFAULT_ENTITY_PERMISSION,
  type: 'table',
};

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest
    .fn()
    .mockImplementation(() => mockGenericContextProps),
}));

jest.mock('../../../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest.fn().mockImplementation(() => ({
    data: mockColumns,
    paging: { total: mockColumns.length },
  })),
  searchTableColumnsByFQN: jest.fn().mockImplementation(() => ({
    data: mockColumns,
    paging: { total: mockColumns.length },
  })),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getAllRowKeysByKeyName: jest.fn(),
  makeData: jest.fn().mockImplementation((value) => value),
  prepareConstraintIcon: jest.fn(),
  updateFieldTags: jest.fn(),
  getTableExpandableConfig: jest.fn().mockImplementation(() => ({
    expandIcon: jest.fn(({ onExpand, expandable, record }) =>
      expandable ? (
        <button data-testid="expand-icon" onClick={(e) => onExpand(record, e)}>
          ExpandIcon
        </button>
      ) : null
    ),
  })),
  getTableColumnConfigSelections: jest
    .fn()
    .mockReturnValue([
      'name',
      'description',
      'dataTypeDisplay',
      'tags',
      'glossary',
    ]),
}));

jest.mock(
  '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: MOCK_TABLE.fullyQualifiedName,
  }),
}));

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

jest.mock('../../../hooks/authHooks', () => {
  return {
    useAuth: jest.fn().mockReturnValue({
      userPermissions: jest.fn().mockReturnValue(true),
      isAdminUser: true,
    }),
  };
});

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest.fn().mockReturnValue(<p>EditorModal</p>),
  })
);

jest.mock('../../Modals/EntityNameModal/EntityNameModal.component', () => {
  return jest.fn().mockReturnValue(<p>EntityNameModal</p>);
});

jest.mock('../../common/ErrorWithPlaceholder/FilterTablePlaceHolder', () => {
  return jest.fn().mockReturnValue(<p>FilterTablePlaceHolder</p>);
});

jest.mock('../../../utils/TagsUtils', () => ({
  getAllTagsList: jest.fn(() => Promise.resolve([])),
  getTagsHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  getGlossaryTermsList: jest.fn(() => Promise.resolve([])),
  getGlossaryTermHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../TableTags/TableTags.component', () => {
  return jest.fn().mockReturnValue(<p>TableTags</p>);
});

jest.mock('../../../utils/TableTags/TableTags.utils', () => ({
  getAllTags: jest.fn(),
  searchTagInData: jest.fn(),
}));

jest.mock('../TableDescription/TableDescription.component', () => {
  return jest.fn().mockReturnValue(<p>TableDescription</p>);
});

const mockTableScrollValue = jest.fn();

jest.mock('../../../constants/Table.constants', () => ({
  get TABLE_SCROLL_VALUE() {
    return mockTableScrollValue();
  },
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/StringsUtils', () => ({
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getEntityColumnFQN: jest.fn(),
}));

jest.mock('../../../utils/TableColumn.util', () => ({
  columnFilterIcon: jest.fn().mockReturnValue(<p>ColumnFilterIcon</p>),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  getEntityByFqn: jest.fn(),
}));

describe('Test EntityTable Component', () => {
  it('Initially, Table should load', async () => {
    await act(async () => {
      render(<SchemaTable />, {
        wrapper: MemoryRouter,
      });
    });

    expect(getTableColumnsByFQN).toHaveBeenCalledWith(
      MOCK_TABLE.fullyQualifiedName,
      { fields: 'tags,customMetrics', limit: 50, offset: 0 }
    );

    const entityTable = await screen.findByTestId('entity-table');

    screen.debug(entityTable);

    expect(entityTable).toBeInTheDocument();
  });

  it('Should render tags and description components', async () => {
    await act(async () => {
      render(<SchemaTable />, {
        wrapper: MemoryRouter,
      });
    });

    expect(getTableColumnsByFQN).toHaveBeenCalledWith(
      MOCK_TABLE.fullyQualifiedName,
      { fields: 'tags,customMetrics', limit: 50, offset: 0 }
    );

    const tableTags = await screen.findAllByText('TableTags');

    expect(tableTags).toHaveLength(6);

    const tableDescription = screen.getAllByText('TableDescription');

    expect(tableDescription).toHaveLength(3);
  });

  it('Table should load empty when no data present', async () => {
    (getTableColumnsByFQN as jest.Mock).mockResolvedValueOnce({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      render(<SchemaTable />, {
        wrapper: MemoryRouter,
      });
    });

    const entityTable = await screen.findByTestId('entity-table');

    expect(entityTable).toBeInTheDocument();

    const emptyPlaceholder = screen.getByText('FilterTablePlaceHolder');

    expect(emptyPlaceholder).toBeInTheDocument();
  });

  it('should render column name only if displayName is not present', async () => {
    (getTableColumnsByFQN as jest.Mock).mockResolvedValue({
      data: mockColumns,
      paging: { total: mockColumns.length },
    });
    render(<SchemaTable />, {
      wrapper: MemoryRouter,
    });

    const columnNames = await screen.findAllByTestId('column-name');

    expect(columnNames).toHaveLength(3);

    expect(columnNames[0].textContent).toBe('comments');
    expect(columnNames[1].textContent).toBe('products');
    expect(columnNames[2].textContent).toBe('platform');
  });

  it('should render column name & displayName for column if both presents', async () => {
    (getTableColumnsByFQN as jest.Mock).mockResolvedValue({
      data: columnsWithDisplayName,
      paging: { total: columnsWithDisplayName.length },
    });
    render(<SchemaTable />, {
      wrapper: MemoryRouter,
    });

    const columnDisplayName = await screen.findAllByTestId(
      'column-display-name'
    );
    const columnName = await screen.findAllByTestId('column-name');

    expect(columnDisplayName[0]).toBeInTheDocument();
    expect(columnName[0]).toBeInTheDocument();

    expect(columnDisplayName[0].textContent).toBe('Comments');
    expect(columnName[0].textContent).toBe('comments');
  });

  it('should not render edit displayName button is table is deleted', async () => {
    mockGenericContextProps.data = {
      ...MOCK_TABLE,
      columns: columnsWithDisplayName,
    } as Table;
    render(<SchemaTable />, {
      wrapper: MemoryRouter,
    });

    expect(
      screen.queryByTestId('edit-displayName-button')
    ).not.toBeInTheDocument();
  });
});
