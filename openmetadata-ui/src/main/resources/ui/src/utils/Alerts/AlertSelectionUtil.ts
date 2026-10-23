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
import { isEmpty, isEqual, isUndefined, sortBy, uniq } from 'lodash';
import {
  AlertCapabilities,
  AlertConditionCapability,
  AlertSourceCapability,
  SourceKind,
} from '../../generated/events/api/alertCapabilities';
import { AlertFilteringInput } from '../../generated/events/api/alertCapabilitiesRequest';
import { EventFilterRule } from '../../generated/events/eventSubscription';
import { EventType } from '../../generated/type/changeEvent';
import type { ModifiedCreateEventSubscription } from '../AlertsClassBase.interface';
import { getEntityNameLabel } from '../EntityNameUtils';
import { t } from '../i18next/LocalUtil';

export interface SelectionSupport {
  supportedFilters?: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
  containerEntities?: string[];
  supportedEventTypes?: EventType[];
  /** Who inside the platform the alert can be sent to. Unknown until the server has answered. */
  recipientCategories?: string[];
  /** Whether the sources support any filter, and so whether the filters section is shown. */
  hasFilters?: boolean;
  /** Whether the sources support any trigger, and so whether the triggers section is shown. */
  hasTriggers?: boolean;
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
 * What the selected sources support: the one place the filters section, the triggers section, the
 * recipients and the pickers inside them get it from. The server answers, with the rules the save
 * applies, so the form cannot offer what the save would reject. Until it has answered for some
 * of the selected sources, what they support is unknown and every field is left out. An answer for
 * no sources, which usually arrives before a saved alert has loaded, says nothing about them.
 * While a new selection is asked about, the answer for the previous one still says which sections
 * are shown, so they do not blink, but nothing it lists can be chosen: it was given for other
 * sources, and the save may reject it.
 */
export const getSelectionSupport = (
  sources: string[] = [],
  selection?: AlertCapabilities,
  answeredFor: string[] = []
): SelectionSupport => {
  const selected = uniq(sources);
  if (selected.length === 0) {
    return { recipientCategories: selection?.recipientCategories };
  }
  if (!selection || answeredFor.length === 0) {
    return {};
  }
  const shown = {
    recipientCategories: selection.recipientCategories,
    hasFilters: !isEmpty(selection.filters),
    hasTriggers: !isEmpty(selection.triggers),
  };
  if (!isEqual(sortBy(uniq(answeredFor)), sortBy(selected))) {
    return shown;
  }

  return {
    ...shown,
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
};

/**
 * Whether a section of rules is shown. With no source chosen it is, empty. Once the server has said
 * whether the sources support any rule of that kind, it is shown when they do. Until then it is
 * shown only for rules the alert already holds, so a saved alert never hides them.
 */
export const shouldShowRuleSection = (
  sources: string[],
  hasRules: boolean | undefined,
  chosenRules: unknown[] | undefined
) => {
  if (isEmpty(sources)) {
    return true;
  }

  return isUndefined(hasRules) ? !isEmpty(chosenRules) : hasRules;
};

/**
 * What choosing other sources does to the rest of an alert, in every alert form. The filters and
 * triggers chosen so far start over, since the new sources may not support them. The destinations
 * start over only when a source is taken away; adding one keeps them. Rules stored without
 * selections stay listed: the form shows them read-only and a save keeps them as stored.
 */
export const getAlertSourceChanges = (
  next: string[],
  previous: string[],
  hasRulesWithoutSelections = false
): Partial<ModifiedCreateEventSubscription> => ({
  resources: next,
  ...(hasRulesWithoutSelections ? {} : { input: {} }),
  ...(previous.some((source) => !next.includes(source))
    ? { destinations: [] }
    : {}),
});

export interface SourceOption {
  name: string;
  disabled: boolean;
  reason?: string;
  warning?: string;
  kind: SourceKind;
}

/**
 * Which sources can be chosen, and what to say about the ones that cannot. The server lists every
 * source of the alert type and says, for each, whether it can join the selection, why it cannot,
 * and which selected source can never produce a match with what has been chosen so far. When its
 * latest answer failed, the sources it listed before are offered as they are.
 */
export const getSourceOptions = (
  selected: string[],
  selection?: AlertCapabilities,
  knownSources: AlertSourceCapability[] = []
): SourceOption[] =>
  (selection?.sources ?? knownSources).map((about) => {
    const isSelected = selected.includes(about.name);
    const canJoin = about.canJoin !== false;

    return {
      name: about.name,
      disabled: !isSelected && !canJoin,
      reason: isSelected || canJoin ? undefined : about.reason,
      warning: isSelected ? about.warning : undefined,
      kind: about.kind,
    };
  });

const KINDS_IN_ORDER = [SourceKind.All, SourceKind.Entity, SourceKind.Activity];

/** Sources grouped by the kind the server gives them, in the order the kinds are offered. */
export const groupSourcesByKind = <T extends { kind: SourceKind }>(
  sources: T[]
) =>
  KINDS_IN_ORDER.map((kind) => ({
    kind,
    sources: sources.filter((source) => source.kind === kind),
  })).filter((group) => group.sources.length > 0);

export const getSourceKindLabel = (kind: SourceKind) => {
  switch (kind) {
    case SourceKind.All:
      return t('label.all-entity', { entity: t('label.event-plural') });
    case SourceKind.Activity:
      return t('label.data-collaboration');
    default:
      return t('label.data-asset-plural');
  }
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
