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
import { UseAlertCapabilitiesReturn } from '../../../hooks/useAlertCapabilities';
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

// Every source, listed by the server with nothing chosen yet.
const LISTED = {
  alertType: 'Notification',
  filters: [],
  triggers: [],
  sources: [
    { name: 'table', kind: 'entity' },
    { name: 'topic', kind: 'entity' },
    { name: 'dashboard', kind: 'entity' },
    { name: 'conversation', kind: 'activity' },
  ],
} as unknown as AlertCapabilities;

const capabilitiesOf = (
  selection?: AlertCapabilities,
  rest: Partial<UseAlertCapabilitiesReturn> = {}
): UseAlertCapabilitiesReturn => ({
  selection,
  knownSources: [],
  loading: false,
  settled: true,
  retry: jest.fn(),
  ...rest,
});

// Timers are fake in every test, so the user moves only as fast as they advance.
const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const open = () => user().click(screen.getByRole('combobox'));

const optionOf = async (source: string) =>
  (await screen.findByTestId(`${source}-option`)).closest('[role="option"]');

describe('AlertSourcePicker', () => {
  it('shows a source that cannot join as disabled, with the reason', async () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(TABLE_AND_TOPIC)}
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

  it('warns beside a selected source that can never match', () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(TABLE_AND_TOPIC)}
        value={['table', 'topic']}
      />
    );

    expect(screen.getByTestId('topic-warning')).toHaveTextContent(
      'Label of topic: No chosen trigger applies to this source.'
    );
    expect(screen.queryByTestId('table-warning')).not.toBeInTheDocument();
  });

  it('names a selected source the way the list does, not by its raw name', () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(LISTED)}
        value={['table']}
      />
    );

    expect(screen.getByTestId('source-select')).toHaveTextContent(
      'Label of table'
    );
  });

  // A saved alert can watch a source the catalog has since retired.
  it('shows a saved source the list does not offer', () => {
    render(
      <AlertSourcePicker
        isDisabled
        capabilities={capabilitiesOf()}
        value={['location']}
      />
    );

    expect(screen.getByTestId('source-select')).toHaveTextContent(
      'Label of location'
    );
  });

  it('hands the whole selection to the form', async () => {
    const onChange = jest.fn();
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(LISTED)}
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
        capabilities={capabilitiesOf(LISTED)}
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

  it('invites the first source, then another, so it reads as a picker of several', () => {
    const { rerender } = render(
      <AlertSourcePicker capabilities={capabilitiesOf(LISTED)} value={[]} />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'placeholder',
      'label.select-field'
    );

    rerender(
      <AlertSourcePicker
        capabilities={capabilitiesOf(LISTED)}
        value={['table']}
      />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'placeholder',
      'label.add-another'
    );
  });

  it('invites nothing in the view of a saved alert', () => {
    render(
      <AlertSourcePicker
        isDisabled
        capabilities={capabilitiesOf(LISTED)}
        value={['table']}
      />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', '');
  });

  it('shows the form error under the picker', () => {
    render(
      <AlertSourcePicker
        isInvalid
        isRequired
        capabilities={capabilitiesOf(LISTED)}
        hint="Source is required"
        value={[]}
      />
    );

    expect(screen.getByText('Source is required')).toBeInTheDocument();
  });

  it('says when the server could not answer, and asks again on Retry', async () => {
    const retry = jest.fn();
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(undefined, { retry })}
        value={[]}
      />
    );

    expect(screen.getByTestId('source-select-error')).toBeInTheDocument();

    await user().click(screen.getByTestId('source-select-retry'));

    expect(retry).toHaveBeenCalled();
  });

  it('says nothing about a failure while it is still asking', () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(undefined, { loading: true })}
        value={[]}
      />
    );

    expect(screen.queryByTestId('source-select-error')).not.toBeInTheDocument();
  });

  it('keeps offering the sources it last listed after a failure', async () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(undefined, {
          knownSources: LISTED.sources,
        })}
        value={[]}
      />
    );
    await open();

    expect(await screen.findByTestId('dashboard-option')).toBeInTheDocument();
  });

  it('groups the sources by kind, each under its header', async () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(TABLE_AND_TOPIC)}
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

  it('keeps a header only while one of its sources matches the search', async () => {
    render(
      <AlertSourcePicker
        capabilities={capabilitiesOf(TABLE_AND_TOPIC)}
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
        capabilities={capabilitiesOf(TABLE_AND_TOPIC)}
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
