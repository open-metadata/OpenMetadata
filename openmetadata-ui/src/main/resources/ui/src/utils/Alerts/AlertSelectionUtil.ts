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
import { isEmpty, uniq } from 'lodash';
import {
  AlertCapabilities,
  AlertConditionCapability,
  AlertSourceCapability,
} from '../../generated/events/api/alertCapabilities';
import { AlertFilteringInput } from '../../generated/events/api/alertCapabilitiesRequest';
import { EventFilterRule } from '../../generated/events/eventSubscription';
import { EventType } from '../../generated/type/changeEvent';
import { getEntityNameLabel } from '../EntityNameUtils';

export interface SourceOfTheCatalog {
  name?: string;
  containerEntities?: string[];
  supportedFilters?: EventFilterRule[];
  supportedActions?: EventFilterRule[];
  supportedEventTypes?: EventType[];
}

export interface SelectionSupport {
  supportedFilters?: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
  containerEntities?: string[];
  supportedEventTypes?: EventType[];
}

// A trigger applies only to the sources that support it, so with several sources it says which.
const labelledWithItsSources = (
  trigger: AlertConditionCapability
): EventFilterRule => {
  const rule = trigger.condition as EventFilterRule;
  const sources = trigger.sources.map(getEntityNameLabel).join(', ');

  return {
    ...rule,
    displayName: `${rule.displayName ?? rule.name} (${sources})`,
  };
};

/**
 * What the selected sources support: the one place the filters section, the triggers section and
 * the pickers inside them get it from. The server answers, with the rules the save applies, so the
 * form cannot offer what the save would reject. Until it has answered, the catalog the form
 * already has says what the first source supports.
 */
export const getSelectionSupport = (
  catalog: SourceOfTheCatalog[],
  sources: string[] = [],
  selection?: AlertCapabilities
): SelectionSupport => {
  const selected = uniq(sources);
  if (selected.length > 0 && selection) {
    return {
      supportedFilters: selection.filters.map(
        (filter) => filter.condition as EventFilterRule
      ),
      // With one source every trigger is its own, and saying so would only be noise.
      supportedTriggers: selection.triggers.map((trigger) =>
        selected.length > 1
          ? labelledWithItsSources(trigger)
          : (trigger.condition as EventFilterRule)
      ),
      containerEntities: selection.containerEntities,
      supportedEventTypes: selection.eventTypes as EventType[] | undefined,
    };
  }
  // Nothing is selected, or the server has not answered yet.
  const only = catalog.find((source) => source.name === selected[0]);

  return {
    supportedFilters: only?.supportedFilters,
    supportedTriggers: only?.supportedActions,
    containerEntities: only?.containerEntities,
    supportedEventTypes: only?.supportedEventTypes,
  };
};

export interface SourceOption {
  name: string;
  disabled: boolean;
  reason?: string;
  warning?: string;
}

/**
 * Which sources can still be chosen, and what to say about the ones that cannot. The server says
 * so for every source: which can join the selection, why another cannot, and which selected source
 * can never produce a match with what has been chosen so far.
 */
export const getSourceOptions = (
  names: string[],
  selected: string[],
  selection?: AlertCapabilities
): SourceOption[] => {
  const said = selection?.sources ?? [];

  return names.map((name) => {
    const about: AlertSourceCapability | undefined = said.find(
      (source) => source.name === name
    );
    const isSelected = selected.includes(name);
    const canJoin = about?.canJoin !== false;

    return {
      name,
      disabled: !isSelected && !canJoin,
      reason: isSelected || canJoin ? undefined : about?.reason,
      warning: isSelected ? about?.warning : undefined,
    };
  });
};

interface ChosenInTheForm {
  name?: string;
  effect?: string;
  arguments?: { name?: string; input?: string[] }[];
}

const onlyWhatIsFilledIn = (chosen?: ChosenInTheForm[]) =>
  (chosen ?? [])
    .filter((row) => Boolean(row?.name))
    .map((row) => ({
      name: row.name,
      effect: row.effect,
      arguments: (row.arguments ?? [])
        .filter((argument) => argument?.name && !isEmpty(argument.input))
        .map((argument) => ({ name: argument.name, input: argument.input })),
    }));

/**
 * What has been chosen so far, as the server reads it. A row the user has only started has no
 * name yet, and the server would refuse the whole question because of it.
 */
export const toCapabilitiesInput = (input?: {
  filters?: ChosenInTheForm[];
  actions?: ChosenInTheForm[];
}) =>
  ({
    filters: onlyWhatIsFilledIn(input?.filters),
    actions: onlyWhatIsFilledIn(input?.actions),
  } as AlertFilteringInput);
