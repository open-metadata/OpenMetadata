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
import { useState } from 'react';
import {
  AlertType,
  Effect,
  InputType,
} from '../../generated/events/eventSubscription';
import { EventType } from '../../generated/type/changeEvent';
import {
  AlertSelection,
  AlertSelectionProvider,
} from '../../hooks/useAlertSelection';
import { ModifiedCreateEventSubscription } from '../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { ClassicAlertRuleSection } from './ClassicAlertRuleSection';

const mockSearchQuery = jest.fn();
jest.mock('../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

const selection: AlertSelection = {
  sources: ['table'],
  loading: false,
  capabilities: { loading: false },
  support: {
    supportedFilters: [
      {
        name: 'domain',
        condition: 'true',
        effect: Effect.Include,
        displayName: 'Domain',
        inputType: InputType.Runtime,
        arguments: ['domainList'],
      },
      {
        name: 'events',
        condition: 'true',
        effect: Effect.Include,
        displayName: 'Event type',
        inputType: InputType.Runtime,
        arguments: ['eventTypeList'],
      },
      {
        name: 'result',
        condition: 'true',
        effect: Effect.Include,
        displayName: 'Test result',
        inputType: InputType.Runtime,
        arguments: ['testResultList'],
      },
    ],
    supportedEventTypes: [EventType.EntityCreated, EventType.EntityUpdated],
  },
  search: {
    indexes: [],
    containerEntities: [],
    byName: async () => [],
    byId: async () => [],
  },
};
const initial: ModifiedCreateEventSubscription = {
  name: 'draft',
  resources: ['table'],
  destinations: [],
  timeout: 10,
  readTimeout: 10,
  alertType: AlertType.Observability,
  input: { filters: [] },
};
const Controlled = ({
  sources = ['table'],
  isViewOnly = false,
  value = initial,
}: {
  sources?: string[];
  isViewOnly?: boolean;
  value?: ModifiedCreateEventSubscription;
}) => {
  const [data, setData] = useState(value);

  return (
    <AlertSelectionProvider value={{ ...selection, sources }}>
      <ClassicAlertRuleSection
        field="filters"
        isViewOnly={isViewOnly}
        title="Filters"
        value={data}
        onChange={setData}
      />
      <output data-testid="payload">{JSON.stringify(data.input)}</output>
    </AlertSelectionProvider>
  );
};

describe('Classic alert rules', () => {
  it('adds a runtime filter, stores its argument and effect, then clears arguments when its type changes', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Controlled />);
    await user.click(screen.getByTestId('add-filters'));
    await user.click(
      screen.getByTestId('filter-select-0').querySelector('button') ??
        screen.getByTestId('filter-select-0')
    );
    await user.click(await screen.findByRole('option', { name: 'Event type' }));
    const input = screen
      .getByTestId('event-type-select')
      .querySelector('input');
    if (!input) {
      throw new Error('Event type input missing');
    }
    await user.click(input);
    await user.type(input, EventType.EntityCreated);
    await user.click(
      await screen.findByRole('option', { name: 'Entity Created' })
    );

    expect(screen.getByTestId('payload')).toHaveTextContent(
      EventType.EntityCreated
    );

    await user.click(screen.getByTestId('filter-switch-0'));

    expect(screen.getByTestId('payload')).toHaveTextContent(Effect.Exclude);

    await user.click(
      screen.getByTestId('filter-select-0').querySelector('button') ??
        screen.getByTestId('filter-select-0')
    );
    await user.click(
      await screen.findByRole('option', { name: 'Test result' })
    );

    expect(screen.getByTestId('payload')).not.toHaveTextContent(
      EventType.EntityCreated
    );
    expect(screen.getByTestId('payload')).toHaveTextContent('testResultList');
    expect(screen.getByTestId('payload')).toHaveTextContent(Effect.Exclude);
  });

  it('keeps a selected domain display name while storing its fully qualified name', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              displayName: 'Domain display',
              fullyQualifiedName: 'domain.raw',
            },
          },
        ],
      },
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <Controlled
        value={{
          ...initial,
          input: {
            filters: [
              {
                name: 'domain',
                effect: Effect.Include,
                arguments: [{ name: 'domainList', input: [] }],
              },
            ],
          },
        }}
      />
    );
    await user.click(
      within(screen.getByTestId('domain-select')).getByRole('combobox')
    );
    await user.click(
      await screen.findByRole('option', { name: 'Domain display' })
    );

    expect(
      within(screen.getByTestId('domain-select')).getByText('Domain display')
    ).toBeVisible();
    expect(screen.getByTestId('payload')).toHaveTextContent('domain.raw');
    expect(screen.getByTestId('payload')).not.toHaveTextContent(
      'Domain display'
    );
  });

  it('removes a rule without losing the remaining rule arguments', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <Controlled
        value={{
          ...initial,
          input: {
            filters: [
              {
                name: 'events',
                effect: Effect.Include,
                arguments: [
                  { name: 'eventTypeList', input: [EventType.EntityCreated] },
                ],
              },
              {
                name: 'result',
                effect: Effect.Exclude,
                arguments: [{ name: 'testResultList', input: ['Failed'] }],
              },
            ],
          },
        }}
      />
    );
    await user.click(screen.getByTestId('remove-filter-0'));

    expect(screen.getByTestId('payload')).not.toHaveTextContent('events');
    expect(screen.getByTestId('payload')).toHaveTextContent('Failed');
    expect(screen.getByTestId('payload')).toHaveTextContent(Effect.Exclude);
    expect(screen.queryByTestId('filter-1')).not.toBeInTheDocument();
  });

  it('disables adding a filter until a source is selected', () => {
    render(<Controlled sources={[]} />);

    expect(screen.getByTestId('add-filters')).toBeDisabled();
  });

  it('keeps saved rules visible and disabled in the configuration view', () => {
    render(
      <Controlled
        isViewOnly
        value={{
          ...initial,
          input: {
            filters: [
              {
                name: 'events',
                arguments: [
                  { name: 'eventTypeList', input: [EventType.EntityCreated] },
                ],
                effect: Effect.Exclude,
              },
            ],
          },
        }}
      />
    );

    expect(
      screen.getByTestId('filter-select-0').querySelector('button')
    ).toBeDisabled();
    expect(
      screen.getByTestId('event-type-select').querySelector('input')
    ).toBeDisabled();
    expect(screen.queryByTestId('remove-filter-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('add-filters')).not.toBeInTheDocument();
    expect(screen.getByTestId('payload')).toHaveTextContent(
      EventType.EntityCreated
    );
  });
});
