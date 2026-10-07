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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    { name: 'dashboard', kind: 'entity', canJoin: true },
    {
      name: 'conversation',
      kind: 'activity',
      canJoin: false,
      reason: 'Sources of different kinds cannot be combined.',
    },
  ],
} as unknown as AlertCapabilities;

const NAMES = ['table', 'topic', 'dashboard', 'conversation'];

// Timers are fake in every test, so the user moves only as fast as they advance.
const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const open = () => user().click(screen.getByRole('combobox'));

const optionOf = async (source: string) =>
  (await screen.findByTestId(`${source}-option`)).closest('[role="option"]');

describe('AlertSourcePicker', () => {
  it('shows a source that cannot join as disabled, with the reason', async () => {
    render(
      <AlertSourcePicker
        selection={TABLE_AND_TOPIC}
        sources={NAMES}
        value={['table', 'topic']}
      />
    );
    await open();

    const conversation = await optionOf('conversation');

    expect(conversation).toHaveAttribute('aria-disabled', 'true');
    expect(conversation).toHaveTextContent(
      'Sources of different kinds cannot be combined.'
    );
    expect(await optionOf('dashboard')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('offers every source until the server has answered about the selection', async () => {
    render(<AlertSourcePicker sources={NAMES} value={['table']} />);
    await open();

    expect(await optionOf('conversation')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
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
      'Label of topic: No chosen trigger applies to this source.'
    );
    expect(screen.queryByTestId('table-warning')).not.toBeInTheDocument();
  });

  it('names a selected source the way the list does, not by its raw name', () => {
    render(<AlertSourcePicker sources={NAMES} value={['table']} />);

    expect(screen.getByTestId('source-select')).toHaveTextContent(
      'Label of table'
    );
  });

  // The view of a saved alert passes no list of sources.
  it('shows a saved source the list does not offer', () => {
    render(<AlertSourcePicker isDisabled sources={[]} value={['location']} />);

    expect(screen.getByTestId('source-select')).toHaveTextContent(
      'Label of location'
    );
  });

  it('hands the whole selection to the form', async () => {
    const onChange = jest.fn();
    render(
      <AlertSourcePicker
        sources={NAMES}
        value={['table']}
        onChange={onChange}
      />
    );
    await open();
    await user().click(await screen.findByTestId('topic-option'));

    expect(onChange).toHaveBeenCalledWith(['table', 'topic'], ['table']);
  });

  it('hands what is left to the form when a source is taken away', async () => {
    const onChange = jest.fn();
    render(
      <AlertSourcePicker
        sources={NAMES}
        value={['table', 'topic']}
        onChange={onChange}
      />
    );
    const [removeTable] = within(
      screen.getByTestId('source-select')
    ).getAllByRole('button');
    await user().click(removeTable);

    expect(onChange).toHaveBeenCalledWith(['topic'], ['table', 'topic']);
  });

  it('groups the sources by kind, each under its header', async () => {
    render(
      <AlertSourcePicker
        selection={TABLE_AND_TOPIC}
        sources={NAMES}
        value={['table']}
      />
    );
    await open();

    const options = await screen.findAllByRole('option');

    expect(
      options.map((option) => option.textContent?.split('Sources')[0])
    ).toEqual([
      'label.data-asset-plural',
      'Label of topic',
      'Label of dashboard',
      'label.data-collaboration',
      'Label of conversation',
    ]);
    expect(await optionOf('header-entity')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('shows no headers until the server has said the kinds', async () => {
    render(<AlertSourcePicker sources={NAMES} value={['table']} />);
    await open();

    await screen.findByTestId('topic-option');

    expect(
      screen.queryByTestId('header-entity-option')
    ).not.toBeInTheDocument();
  });

  it('keeps a header only while one of its sources matches the search', async () => {
    render(
      <AlertSourcePicker
        selection={TABLE_AND_TOPIC}
        sources={NAMES}
        value={['table']}
      />
    );
    await user().type(screen.getByRole('combobox'), 'dash');

    expect(
      await screen.findByTestId('header-entity-option')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('header-activity-option')
    ).not.toBeInTheDocument();
  });

  it('drops a header once every source under it is chosen', async () => {
    render(
      <AlertSourcePicker
        selection={TABLE_AND_TOPIC}
        sources={NAMES}
        value={['table', 'topic', 'dashboard']}
      />
    );
    await open();

    await screen.findByTestId('conversation-option');

    expect(
      screen.queryByTestId('header-entity-option')
    ).not.toBeInTheDocument();
  });
});
