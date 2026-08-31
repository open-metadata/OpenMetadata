/*
 *  Copyright 2026 Collate.
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
import { act, render, waitFor } from '@testing-library/react';
import { ColumnsType } from '../../../../common/Table/Table.interface';
import { useGenericContext } from '../../../../Customization/GenericProvider/GenericContext';
import ModelTab from './ModelTab.component';

// No prior test coverage for this file (Task 8 characterization-first rule). Scope is
// deliberately narrow — only the permission-flag wiring this batch touched, following the
// WorksheetColumnsTable.test.tsx / FileColumnsTable.test.tsx precedent: the mocked <Table>
// renders `dataSource` directly (bypassing antd-style column `render` callbacks), so tests
// read the `columns` prop actually passed to it and invoke each column's `render` function
// directly to inspect the wired permission prop.

jest.mock(
  '../../../../Customization/GenericProvider/GenericContext',
  () => ({
    useGenericContext: jest.fn(),
  })
);

jest.mock('../../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    pageSize: 25,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: false,
    paging: { total: 0 },
    handlePagingChange: jest.fn(),
  }),
}));

jest.mock('../../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ columnPart: undefined, fqn: 'fqn' }),
}));

jest.mock('../../../../../rest/dataModelsAPI', () => ({
  getDataModelColumnsByFQN: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
  searchDataModelColumnsByFQN: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
  updateDataModelColumn: jest.fn(),
}));

let capturedColumns: ColumnsType<Record<string, unknown>> = [];

jest.mock('../../../../common/Table/Table', () =>
  jest.fn().mockImplementation((props: { columns: unknown }) => {
    capturedColumns = props.columns as typeof capturedColumns;

    return <div data-testid="model-tab-table" />;
  })
);

jest.mock(
  '../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () => jest.fn().mockImplementation(() => <div />)
);

const mockRecord = {
  name: 'test-column',
  fullyQualifiedName: 'test-data-model.test-column',
  dataType: 'STRING',
};

const getColumnByKey = (key: string) =>
  capturedColumns.find((col) => 'key' in col && col.key === key);

const renderModelTab = async () => {
  render(<ModelTab />);
  // Table is mocked, so the columns prop it's called with is captured synchronously on
  // mount — but also wait for the mocked getDataModelColumnsByFQN effect to settle, so its
  // state update doesn't leak (as an act() warning, or a stray render) into whichever test
  // happens to run next.
  await waitFor(() => {
    expect(capturedColumns.length).toBeGreaterThan(0);
  });
  await act(async () => {
    await Promise.resolve();
  });
};

describe('ModelTab permission wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedColumns = [];
  });

  const setContext = (
    permissions: Record<string, boolean>,
    deleted = false
  ) => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: {
        fullyQualifiedName: 'test-data-model',
        deleted,
        columns: [],
      },
      permissions,
      openColumnDetailPanel: jest.fn(),
      selectedColumn: null,
      setDisplayedColumns: jest.fn(),
    });
  };

  it('grants description/tags/glossary-term edit via EditAll regardless of deleted', async () => {
    setContext({ EditAll: true }, true);

    await renderModelTab();

    const descriptionCol = getColumnByKey('description');
    const tagsCol = getColumnByKey('tags');
    const glossaryCol = getColumnByKey('glossary');

    const descriptionEl = descriptionCol?.render?.(
      undefined,
      mockRecord,
      0
    ) as React.ReactElement;
    const tagsEl = tagsCol?.render?.(
      [],
      mockRecord,
      0
    ) as React.ReactElement;
    const glossaryEl = glossaryCol?.render?.(
      [],
      mockRecord,
      0
    ) as React.ReactElement;

    expect(descriptionEl.props.hasEditPermission).toBe(true);
    expect(tagsEl.props.hasTagEditAccess).toBe(true);
    expect(glossaryEl.props.hasTagEditAccess).toBe(true);
  });

  it('denies description edit when EditDescription is explicitly false, even with EditAll true', async () => {
    // Explicit-deny-wins fix (Task 6 Finding 1): the old raw `EditAll || EditDescription` OR
    // granted regardless of an explicit EditDescription:false.
    setContext({ EditAll: true, EditDescription: false });

    await renderModelTab();

    const descriptionCol = getColumnByKey('description');
    const descriptionEl = descriptionCol?.render?.(
      undefined,
      mockRecord,
      0
    ) as React.ReactElement;

    expect(descriptionEl.props.hasEditPermission).toBe(false);
  });

  it('denies display-name edit when the data model is deleted, even with EditAll true', async () => {
    setContext({ EditAll: true }, true);

    await renderModelTab();

    const nameCol = getColumnByKey('name');
    const nameEl = nameCol?.render?.(
      undefined,
      mockRecord,
      0
    ) as React.ReactElement;

    expect(nameEl.props.hasEditPermission).toBe(false);
  });

  it('grants display-name edit via EditAll when not deleted', async () => {
    setContext({ EditAll: true }, false);

    await renderModelTab();

    const nameCol = getColumnByKey('name');
    const nameEl = nameCol?.render?.(
      undefined,
      mockRecord,
      0
    ) as React.ReactElement;

    expect(nameEl.props.hasEditPermission).toBe(true);
  });
});
