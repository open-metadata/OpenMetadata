/*
 *  Copyright 2023 Collate.
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
import {
  PipelineStatus,
  StatusType,
} from '../../../generated/entity/data/pipeline';
import { getAllPipelineStatuses } from '../../../rest/pipelineAPI';
import ExecutionsTab from './Execution.component';

jest.mock('./ListView/ListViewTab.component', () =>
  jest
    .fn()
    .mockImplementation(
      ({ executions }: { executions?: Array<PipelineStatus> }) => (
        <div>
          ListViewTab
          <span data-testid="execution-count">{executions?.length ?? 0}</span>
        </div>
      )
    )
);

jest.mock('./TreeView/TreeViewTab.component', () =>
  jest.fn().mockImplementation(() => <div>TreeViewTab</div>)
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockReturnValue(2000),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1000),
}));

jest.mock('../../../rest/pipelineAPI', () => ({
  getAllPipelineStatuses: jest.fn().mockResolvedValue([]),
}));

const run = (timestamp: number): PipelineStatus => ({
  executionStatus: StatusType.Successful,
  timestamp,
});

jest.mock('../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>Searchbar</div>)
);

const mockProps = {
  pipelineFQN: 'pipelineFQN',
  tasks: [],
};

describe('Test Execution Component', () => {
  it('Should show every status the selected range returns', async () => {
    (getAllPipelineStatuses as jest.Mock).mockResolvedValueOnce([
      run(1),
      run(2),
      run(3),
    ]);

    render(<ExecutionsTab {...mockProps} />);

    await waitFor(() =>
      expect(screen.getByTestId('execution-count')).toHaveTextContent('3')
    );

    expect(getAllPipelineStatuses).toHaveBeenCalledWith(
      'pipelineFQN',
      { endTs: 2000, startTs: 1000 },
      expect.any(AbortSignal)
    );
  });

  it('Should keep the newest read when a superseded one resolves last', async () => {
    let resolveSuperseded: ((statuses: PipelineStatus[]) => void) | undefined;
    (getAllPipelineStatuses as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise<PipelineStatus[]>((resolve) => {
            resolveSuperseded = resolve;
          })
      )
      .mockResolvedValueOnce([run(1)]);

    const { rerender } = render(<ExecutionsTab {...mockProps} />);
    rerender(<ExecutionsTab {...mockProps} pipelineFQN="otherPipelineFQN" />);

    await waitFor(() =>
      expect(screen.getByTestId('execution-count')).toHaveTextContent('1')
    );

    await act(async () => {
      resolveSuperseded?.([run(2), run(3)]);
    });

    expect(screen.getByTestId('execution-count')).toHaveTextContent('1');
    expect((getAllPipelineStatuses as jest.Mock).mock.calls[0][2].aborted).toBe(
      true
    );
  });

  it('Should render component properly', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByTestId('execution-tab')).toBeInTheDocument();
    expect(screen.getByTestId('radio-switch')).toBeInTheDocument();
    expect(screen.getByTestId('status-button')).toHaveTextContent(
      'label.status'
    );
    expect(screen.getByTestId('status-button')).toHaveClass(
      'tw:after:outline-primary'
    );
    expect(screen.getByTestId('data-range-picker')).toBeInTheDocument();
  });

  it('Should render ListViewTab component', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByText('ListViewTab')).toBeInTheDocument();
  });

  it('Should render TreeViewTab component on tabView change', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByText('ListViewTab')).toBeInTheDocument();

    const treeRadioButton = screen.getByRole('radio', { name: 'Tree' });

    act(() => {
      fireEvent.click(treeRadioButton);
    });

    expect(treeRadioButton).toBeChecked();
    expect(screen.getByRole('radio', { name: 'List' })).not.toBeChecked();
    expect(screen.getByText('TreeViewTab')).toBeInTheDocument();
  });

  it('Should render data picker button only on Tree View Tab', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByText('ListViewTab')).toBeInTheDocument();

    expect(screen.getByTestId('data-range-picker')).toBeInTheDocument();

    const treeRadioButton = screen.getByRole('radio', { name: 'Tree' });

    act(() => {
      fireEvent.click(treeRadioButton);
    });

    expect(screen.getByText('TreeViewTab')).toBeInTheDocument();

    expect(screen.queryByTestId('data-range-picker')).not.toBeInTheDocument();
  });

  it('Should show the picked status and highlight the trigger', async () => {
    render(<ExecutionsTab {...mockProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('status-button'));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Failed' }));
    });

    const trigger = screen.getByTestId('status-button');

    expect(trigger).toHaveTextContent('Failed');
    expect(trigger).toHaveClass(
      'tw:text-fg-brand-primary',
      'tw:after:outline-brand'
    );
  });
});
