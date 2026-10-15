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

import { render, screen } from '@testing-library/react';
import { AlertType, Effect } from '../../../generated/events/eventSubscription';
import {
  AlertSelection,
  AlertSelectionProvider,
} from '../../../hooks/useAlertSelection';
import ObservabilityFormTriggerItem from './ObservabilityFormTriggerItem';

const selection: AlertSelection = {
  sources: ['table'],
  support: {
    supportedFilters: [
      {
        name: 'filter',
        displayName: 'Filter',
        condition: 'true',
        effect: Effect.Include,
      },
    ],
    supportedTriggers: [
      {
        name: 'trigger',
        displayName: 'Trigger',
        condition: 'true',
        effect: Effect.Include,
      },
    ],
  },
  capabilities: { loading: false },
  loading: false,
  search: {
    indexes: [],
    containerEntities: [],
    byName: async () => [],
    byId: async () => [],
  },
};

it('renders the trigger section with its saved rules', () => {
  render(
    <AlertSelectionProvider value={selection}>
      <ObservabilityFormTriggerItem
        isViewMode
        value={{
          name: 'saved',
          alertType: AlertType.Observability,
          resources: ['table'],
          destinations: [],
          timeout: 10,
          readTimeout: 10,
          input: { actions: [{ name: 'trigger' }] },
        }}
      />
    </AlertSelectionProvider>
  );

  expect(
    screen.getByTestId('trigger-select-0').querySelector('button')
  ).toBeDisabled();
});
