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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from '../../../../generated/entity/data/table';
import {
  IngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { MOCK_TABLE } from '../../../../mocks/TableData.mock';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
  updateIngestionPipeline,
} from '../../../../rest/ingestionPipelineAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import TestSuitePipelineFormDrawer from './TestSuitePipelineFormDrawer';

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn(),
  deployIngestionPipelineById: jest.fn(),
  updateIngestionPipeline: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => ({ isAirflowAvailable: true }),
  })
);

jest.mock(
  '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval',
  () => jest.fn(() => <div>ScheduleInterval</div>)
);

jest.mock('../../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({
    name: 'Pipeline name doc',
    raiseOnError: 'Raise on error doc',
  }),
}));

// The real previewer wraps a lazy TipTap editor that does not render in jsdom.
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn(({ markdown }: { markdown: string }) => <div>{markdown}</div>)
);

const mockAddTestCaseList = jest.fn();
jest.mock('../../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: (props: Record<string, unknown>) => {
    mockAddTestCaseList(props);

    return <div>AddTestCaseList</div>;
  },
}));

const EDITED_PIPELINE = {
  id: 'pipe-id',
  name: 'pipe',
  displayName: 'Nightly',
  pipelineType: PipelineType.TestSuite,
  loggerLevel: LogLevels.Info,
  raiseOnError: true,
  service: { id: 'suite-id', type: 'testSuite' },
  airflowConfig: { scheduleInterval: '0 0 * * *' },
  sourceConfig: {
    config: {
      entityFullyQualifiedName: 'svc.db.schema.orders',
      testCases: ['tc_a'],
    },
  },
} as IngestionPipeline;

const TABLE = {
  ...MOCK_TABLE,
  testSuite: { id: 'suite-id', type: 'testSuite' },
} as Table;

const renderDrawer = () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(
    <TestSuitePipelineFormDrawer
      open
      table={TABLE}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );

  return { onClose, onSuccess };
};

describe('TestSuitePipelineFormDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates and deploys a pipeline for the table suite, then closes', async () => {
    (addIngestionPipeline as jest.Mock).mockResolvedValue({ id: 'pipe-id' });
    (deployIngestionPipelineById as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onClose, onSuccess } = renderDrawer();

    await user.type(await screen.findByTestId('pipeline-name'), 'nightly');
    await user.click(screen.getByRole('switch', { name: /select-all-entity/ }));
    await user.click(screen.getByTestId('deploy-button'));

    await waitFor(() =>
      expect(addIngestionPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'nightly',
          raiseOnError: true,
          service: { id: 'suite-id', type: 'testSuite' },
          sourceConfig: {
            config: expect.objectContaining({
              entityFullyQualifiedName: TABLE.fullyQualifiedName,
              testCases: undefined,
            }),
          },
        })
      )
    );

    expect(deployIngestionPipelineById).toHaveBeenCalledWith('pipe-id');
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.create-entity-success'
    );
    expect(onSuccess).toHaveBeenCalled();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('requires a test case unless all test cases are selected', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onClose } = renderDrawer();

    await user.click(await screen.findByTestId('deploy-button'));

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(addIngestionPipeline).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the drawer open when creating the pipeline fails', async () => {
    (addIngestionPipeline as jest.Mock).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onClose, onSuccess } = renderDrawer();

    await user.click(
      await screen.findByRole('switch', { name: /select-all-entity/ })
    );
    await user.click(screen.getByTestId('deploy-button'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(deployIngestionPipelineById).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still reports success when only the deploy fails', async () => {
    (addIngestionPipeline as jest.Mock).mockResolvedValue({ id: 'pipe-id' });
    (deployIngestionPipelineById as jest.Mock).mockRejectedValue(
      new Error('deploy failed')
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onClose, onSuccess } = renderDrawer();

    await user.click(
      await screen.findByRole('switch', { name: /select-all-entity/ })
    );
    await user.click(screen.getByTestId('deploy-button'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(showErrorToast).toHaveBeenCalledWith(
      expect.any(Error),
      'server.deploy-entity-error'
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('opens on the first field doc and hides the hint panel with Show Hint', async () => {
    renderDrawer();

    expect(await screen.findByText('Pipeline name doc')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'label.show-hint' }));
    });

    expect(screen.queryByText('Pipeline name doc')).not.toBeInTheDocument();
  });

  it('shows the doc of the focused field', async () => {
    renderDrawer();

    await screen.findByText('Pipeline name doc');

    await act(async () => {
      screen.getByRole('switch', { name: 'label.raise-on-error' }).focus();
    });

    expect(await screen.findByText('Raise on error doc')).toBeInTheDocument();
  });

  it('edits a pipeline in place: prefilled, patched, redeployed', async () => {
    (updateIngestionPipeline as jest.Mock).mockResolvedValue({
      id: 'pipe-id',
    });
    (deployIngestionPipelineById as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onSuccess = jest.fn();
    render(
      <TestSuitePipelineFormDrawer
        open
        ingestionPipeline={EDITED_PIPELINE}
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    );

    expect(await screen.findByText('label.edit-entity')).toBeInTheDocument();

    const name = screen.getByTestId('pipeline-name');

    expect(name).toHaveValue('Nightly');
    expect(mockAddTestCaseList).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedTest: ['tc_a'] })
    );

    await user.clear(name);
    await user.type(name, 'Hourly');
    await user.click(screen.getByTestId('deploy-button'));

    await waitFor(() =>
      expect(updateIngestionPipeline).toHaveBeenCalledWith('pipe-id', [
        { op: 'replace', path: '/displayName', value: 'Hourly' },
      ])
    );

    expect(addIngestionPipeline).not.toHaveBeenCalled();
    expect(deployIngestionPipelineById).toHaveBeenCalledWith('pipe-id');
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.update-entity-success'
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("adds a bundle suite's pipeline scoped by the suite, with no table", async () => {
    (addIngestionPipeline as jest.Mock).mockResolvedValue({ id: 'new-id' });
    (deployIngestionPipelineById as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <TestSuitePipelineFormDrawer
        open
        testSuite={
          {
            id: 'bundle-id',
            basic: false,
            name: 'nightly_bundle',
            fullyQualifiedName: 'nightly_bundle',
          } as TestSuite
        }
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    await screen.findByTestId('pipeline-name');

    expect(mockAddTestCaseList).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hideTableFilter: false,
        testCaseParams: { testSuiteId: 'bundle-id' },
      })
    );

    await user.click(screen.getByRole('switch', { name: /select-all-entity/ }));
    await user.click(screen.getByTestId('deploy-button'));

    await waitFor(() =>
      expect(addIngestionPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          service: { id: 'bundle-id', type: 'testSuite' },
          sourceConfig: {
            config: expect.objectContaining({
              entityFullyQualifiedName: undefined,
            }),
          },
        })
      )
    );
  });
});
