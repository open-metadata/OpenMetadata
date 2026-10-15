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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Column, DataType } from '../../../generated/entity/data/table';
import {
  expectClientPaging,
  renderPageAt,
} from '../../../test/unit/pagingScenarios';
import VersionTable from './VersionTable.component';

jest.mock(
  '../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    ({ markdown }: { markdown: string }) =>
      <span>{markdown}</span>
);

jest.mock(
  '../../common/RichTextEditor/RichTextEditorPreviewNew',
  () =>
    ({ markdown }: { markdown: string }) =>
      <span>{markdown}</span>
);

jest.mock('../../Tag/TagsViewer/TagsViewer', () => () => null);

const URL = '/table/svc.db.schema.version_table/versions/0.1?pageSize=15';

const columns: Column[] = Array.from({ length: 20 }, (_, i) => {
  const name = `version_col_${String(i + 1).padStart(2, '0')}`;

  return {
    name,
    fullyQualifiedName: `svc.db.schema.version_table.${name}`,
    dataType: DataType.Varchar,
    dataTypeDisplay: 'varchar',
    description: `Version test column ${i + 1}`,
  };
});

const versionTable = (
  <VersionTable columnName="version_table" columns={columns} />
);

describe('VersionTable pagination', () => {
  it('pages columns client-side, keeps the page across a reload and resizes', async () => {
    await expectClientPaging({
      url: URL,
      ui: versionTable,
      tableTestId: 'entity-table',
    });
  });

  it('narrows the columns to the search match', async () => {
    renderPageAt(URL, versionTable);

    const table = await screen.findByTestId('entity-table');

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'version_col_01' },
    });

    await waitFor(() =>
      expect(within(table).getAllByRole('row')).toHaveLength(2)
    );

    expect(within(table).getByText('version_col_01')).toBeInTheDocument();
  });
});
