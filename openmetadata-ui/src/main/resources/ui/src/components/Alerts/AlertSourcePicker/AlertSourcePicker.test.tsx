/*
 *  Copyright 2024 Collate.
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
import { AlertCapabilities } from '../../../generated/events/api/alertCapabilities';
import AlertSourcePicker from './AlertSourcePicker';

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityNameLabel: jest
    .fn()
    .mockImplementation((name: string) => `Label of ${name}`),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: { getEntityIconWithBg: jest.fn().mockReturnValue(null) },
}));

const TABLE_AND_TOPIC = {
  alertType: 'Notification',
  filters: [],
  triggers: [],
  sources: [
    { name: 'table', kind: 'entity', selected: true },
    {
      name: 'topic',
      kind: 'entity',
      selected: true,
      warning: 'No chosen trigger applies to this source.',
    },
    {
      name: 'conversation',
      kind: 'activity',
      canJoin: false,
      reason: 'Sources of different kinds cannot be combined.',
    },
  ],
} as unknown as AlertCapabilities;

const NAMES = ['table', 'topic', 'conversation'];

const open = () =>
  fireEvent.mouseDown(
    screen
      .getByTestId('source-select')
      .querySelector('.ant-select-selector') as Element
  );

describe('AlertSourcePicker', () => {
  it('shows a source that cannot join as disabled, with the reason', () => {
    render(
      <AlertSourcePicker
        selection={TABLE_AND_TOPIC}
        sources={NAMES}
        value={['table', 'topic']}
      />
    );
    open();

    expect(screen.getByTestId('conversation-reason')).toHaveTextContent(
      'Sources of different kinds cannot be combined.'
    );
    expect(
      screen.getByTestId('conversation-option').closest('.ant-select-item')
    ).toHaveClass('ant-select-item-option-disabled');
    expect(
      screen.getByTestId('topic-option').closest('.ant-select-item')
    ).not.toHaveClass('ant-select-item-option-disabled');
  });

  it('offers every source until the server has answered about the selection', () => {
    render(<AlertSourcePicker sources={NAMES} value={['table']} />);
    open();

    expect(screen.queryByTestId('conversation-reason')).not.toBeInTheDocument();
  });

  it('warns beside a selected source that can never match', () => {
    render(
      <AlertSourcePicker
        selection={TABLE_AND_TOPIC}
        sources={NAMES}
        value={['table', 'topic']}
      />
    );

    expect(screen.getByTestId('topic-warning')).toHaveTextContent(
      'topic: No chosen trigger applies to this source.'
    );
    expect(screen.queryByTestId('table-warning')).not.toBeInTheDocument();
  });

  it('names a selected source the way the list does, not by its raw name', () => {
    render(
      <AlertSourcePicker
        sources={NAMES}
        value={['table']}
        onChange={jest.fn()}
      />
    );

    const selected = screen
      .getByTestId('source-select')
      .querySelector('.ant-select-selection-item-content');

    expect(selected).toHaveTextContent('Label of table');
  });

  it('hands the whole selection to the form', () => {
    const onChange = jest.fn();
    render(
      <AlertSourcePicker
        sources={NAMES}
        value={['table']}
        onChange={onChange}
      />
    );
    open();
    fireEvent.click(screen.getByTestId('topic-option'));

    expect(onChange).toHaveBeenCalledWith(['table', 'topic'], ['table']);
  });
});
