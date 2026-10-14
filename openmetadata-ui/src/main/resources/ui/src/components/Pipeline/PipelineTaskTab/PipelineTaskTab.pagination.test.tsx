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
import { act, fireEvent, screen } from '@testing-library/react';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import {
  expectClientPaging,
  renderPageAt,
} from '../../../test/unit/pagingScenarios';
import { PipelineTaskTab } from './PipelineTaskTab';

const TASK_COUNT = 20;
const URL = '/pipeline/svc.pipeline?pageSize=15';

const mockPipeline = {
  id: 'pipeline-id',
  name: 'pipeline',
  fullyQualifiedName: 'svc.pipeline',
  tasks: Array.from({ length: TASK_COUNT }, (_, i) => ({
    name: `pw_task_${i + 1}`,
    displayName: `PW Task ${i + 1}`,
    fullyQualifiedName: `svc.pipeline.pw_task_${i + 1}`,
  })),
} as Pipeline;

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => ({
    data: mockPipeline,
    permissions: {},
    onUpdate: jest.fn(),
    openColumnDetailPanel: jest.fn(),
    selectedColumn: null,
    setDisplayedColumns: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ entityFqn: 'svc.pipeline', columnFqn: '', fqn: '' }),
}));

jest.mock(
  '../../Database/TableDescription/TableDescription.component',
  () => () => null
);

jest.mock('../../Database/TableTags/TableTags.component', () => () => null);

const taskRowCount = () =>
  screen.getByTestId('task-table').querySelectorAll('tbody > tr[data-row-key]')
    .length;

describe('PipelineTaskTab pagination', () => {
  it('pages tasks client-side, keeps the page across a reload and resizes', async () => {
    await expectClientPaging({
      url: URL,
      ui: <PipelineTaskTab />,
      tableTestId: 'task-table',
    });
  });

  it('shows at most pageSize tasks per page and every task across the pages', async () => {
    renderPageAt(URL, <PipelineTaskTab />);

    await screen.findByTestId('task-table');
    const page1RowCount = taskRowCount();

    expect(page1RowCount).toBeLessThanOrEqual(15);

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });
    const page2RowCount = taskRowCount();

    expect(page2RowCount).toBeLessThanOrEqual(15);
    expect(page1RowCount + page2RowCount).toBe(TASK_COUNT);
  });
});
