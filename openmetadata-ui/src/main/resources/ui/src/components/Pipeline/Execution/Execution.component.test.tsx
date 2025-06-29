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

import { act, fireEvent, render, screen } from '@testing-library/react';
import ExecutionsTab from './Execution.component';

jest.mock('./ListView/ListViewTab.component', () =>
  jest.fn().mockImplementation(() => <div>ListViewTab</div>)
);

jest.mock('./TreeView/TreeViewTab.component', () =>
  jest.fn().mockImplementation(() => <div>TreeViewTab</div>)
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockImplementation((data) => data),
  getEpochMillisForPastDays: jest
    .fn()
    .mockImplementation(() => <div>StatusIndicator</div>),
}));

jest.mock('../../../rest/pipelineAPI', () => ({
  getPipelineStatus: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
    })
  ),
}));

jest.mock('../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>Searchbar</div>)
);

const mockProps = {
  pipelineFQN: 'pipelineFQN',
  tasks: [],
};

describe('Test Execution Component', () => {
  it('Should render component properly', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByTestId('execution-tab')).toBeInTheDocument();
    expect(screen.getByTestId('radio-switch')).toBeInTheDocument();
    expect(screen.getByTestId('status-button')).toBeInTheDocument();
    expect(screen.getByTestId('data-range-picker-button')).toBeInTheDocument();
    expect(screen.getByTestId('data-range-picker')).toBeInTheDocument();
  });

  it('Should render ListViewTab component', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByText('ListViewTab')).toBeInTheDocument();
  });

  it('Should render TreeViewTab component on tabView change', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByText('ListViewTab')).toBeInTheDocument();

    const treeRadioButton = screen.getByText('Tree');

    act(() => {
      fireEvent.click(treeRadioButton);
    });

    expect(screen.getByText('TreeViewTab')).toBeInTheDocument();
  });

  it('Should render data picker button only on Tree View Tab', async () => {
    render(<ExecutionsTab {...mockProps} />);

    expect(screen.getByText('ListViewTab')).toBeInTheDocument();

    expect(screen.getByTestId('data-range-picker-button')).toBeInTheDocument();

    const treeRadioButton = screen.getByText('Tree');

    act(() => {
      fireEvent.click(treeRadioButton);
    });

    expect(screen.getByText('TreeViewTab')).toBeInTheDocument();

    expect(
      screen.queryByTestId('data-range-picker-button')
    ).not.toBeInTheDocument();
  });
});
