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
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import GlobalSearchTaskBar, {
  GlobalSearchTaskBarProps,
} from './GlobalSearchTaskBar';

const onStatusChange = jest.fn();
const onTypeChange = jest.fn();

const renderBar = (props: Partial<GlobalSearchTaskBarProps> = {}) =>
  render(
    <GlobalSearchTaskBar
      isVisible
      onStatusChange={onStatusChange}
      onTypeChange={onTypeChange}
      {...props}
    />
  );

describe('GlobalSearchTaskBar', () => {
  it('renders nothing when hidden', () => {
    renderBar({ isVisible: false });

    expect(
      screen.queryByTestId('global-search-task-status')
    ).not.toBeInTheDocument();
  });

  it('shows the status and type filters without clear when nothing is set', () => {
    renderBar();

    expect(screen.getByTestId('global-search-task-status')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-task-type')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.clear-filter-plural' })
    ).not.toBeInTheDocument();
  });

  it('selects a status', async () => {
    renderBar();

    fireEvent.click(screen.getByTestId('global-search-task-status'));
    fireEvent.click(await screen.findByTestId(TaskStatus.Open));

    expect(onStatusChange).toHaveBeenCalledWith(TaskStatus.Open);
  });

  it('clears both filters', () => {
    renderBar({ status: TaskStatus.Open, type: TaskType.RequestApproval });

    fireEvent.click(
      screen.getByRole('button', { name: 'label.clear-filter-plural' })
    );

    expect(onStatusChange).toHaveBeenCalledWith(undefined);
    expect(onTypeChange).toHaveBeenCalledWith(undefined);
  });
});
