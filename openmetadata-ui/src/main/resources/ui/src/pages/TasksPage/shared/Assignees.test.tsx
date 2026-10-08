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

import { act, fireEvent, render, screen } from '@testing-library/react';
import Assignees from './Assignees';

const mockOptions = [
  {
    label: 'adam_matthews2',
    name: 'adam_matthews2',
    value: 'b76b005d-3540-4f85-86db-197abdcaf351',
    type: 'user',
  },
  {
    label: 'alec_kane4',
    name: 'alec_kane4',
    value: 'c1c41191-fee0-4754-b1a4-55079f8ff0df',
    type: 'user',
  },
  {
    label: 'Data Platform',
    name: 'data_platform',
    value: 'ad861728-76d4-4b03-be5e-f0655b71a9ac',
    type: 'team',
  },
];

const mockProps = {
  options: mockOptions,
  value: [],
  onSearch: jest.fn(),
  onChange: jest.fn(),
};

jest.mock('../../../components/common/UserTag/UserTag.component', () => ({
  UserTag: jest.fn().mockImplementation(({ name }) => <div>{name}</div>),
}));

const openList = async () => {
  const input = await screen.findByRole('combobox');

  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });

  return input;
};

describe('Test assignees component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should render the grouped team and user options', async () => {
    render(<Assignees {...mockProps} />);

    await openList();

    expect(await screen.findByTestId('adam_matthews2')).toBeInTheDocument();
    expect(screen.getByTestId('data_platform')).toBeInTheDocument();
    expect(screen.getByText('label.team-plural')).toBeInTheDocument();
    expect(screen.getByText('label.user-plural')).toBeInTheDocument();
  });

  it('Should emit the picked assignee with its type and name', async () => {
    render(<Assignees {...mockProps} />);

    await openList();
    fireEvent.click(await screen.findByTestId('adam_matthews2'));

    expect(mockProps.onChange).toHaveBeenCalledWith([
      {
        label: undefined,
        value: mockOptions[0].value,
        type: 'user',
        name: 'adam_matthews2',
        displayName: undefined,
      },
    ]);
  });

  it('Should append to existing assignees in multi select mode', async () => {
    render(<Assignees {...mockProps} value={[mockOptions[0]]} />);

    await openList();

    expect(screen.queryByTestId('adam_matthews2')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByTestId('data_platform'));

    expect(mockProps.onChange).toHaveBeenCalledWith([
      expect.objectContaining({ value: mockOptions[0].value }),
      expect.objectContaining({ value: mockOptions[2].value, type: 'team' }),
    ]);
  });

  it('Should resolve bare id values to their option label', async () => {
    render(<Assignees {...mockProps} value={[mockOptions[1].value]} />);

    expect(
      await screen.findByTestId('autocomplete-selected-item')
    ).toHaveTextContent('alec_kane4');
  });

  it('Should clear a single select to undefined', async () => {
    render(
      <Assignees {...mockProps} isSingleSelect value={[mockOptions[0]]} />
    );

    const chip = await screen.findByTestId('autocomplete-selected-item');
    fireEvent.click(chip.querySelector('button') as HTMLButtonElement);

    expect(mockProps.onChange).toHaveBeenCalledWith(undefined);
  });

  it('Should replace the pick in single select mode', async () => {
    render(
      <Assignees {...mockProps} isSingleSelect value={[mockOptions[0]]} />
    );

    await openList();
    fireEvent.click(await screen.findByTestId('alec_kane4'));

    expect(mockProps.onChange).toHaveBeenCalledWith([
      expect.objectContaining({ value: mockOptions[1].value }),
    ]);
  });

  it('Should debounce the search', async () => {
    jest.useFakeTimers();
    render(<Assignees {...mockProps} />);

    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'ad' } });
    fireEvent.change(input, { target: { value: 'adam' } });

    expect(mockProps.onSearch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockProps.onSearch).toHaveBeenCalledTimes(1);
    expect(mockProps.onSearch).toHaveBeenCalledWith('adam');

    jest.useRealTimers();
  });

  it('Should disable the input', async () => {
    render(<Assignees {...mockProps} disabled id="assignees" />);

    const input = await screen.findByRole('combobox');

    expect(input).toBeDisabled();
    // antd Form.Item injected this id; Playwright targets `#assignees`.
    expect(input).toHaveAttribute('id', 'assignees');
  });
});
