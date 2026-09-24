/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;

/**
 * Where an alert's rules come from, and so what a save does with them. Rules compiled from the
 * selections made in the form are compiled again from them. Rules written by hand, by the system
 * or by another product have no selections behind them, and nothing may replace them. An alert
 * keeps its kind until a save brings selections, which makes it one compiled from them.
 */
public sealed interface AlertDefinitionPolicy {

  /** Sets the rules a new alert is stored with, or rejects a definition that cannot be built. */
  void prepareNew(EventSubscription alert);

  /** Sets the rules an update is stored with. Only a definition that changed is validated. */
  void settle(EventSubscription stored, EventSubscription updated, boolean isPut);

  static AlertDefinitionPolicy ofNew(EventSubscription alert) {
    return of(alert.getAlertType(), alert.getInput(), alert.getFilteringRules());
  }

  // The stored rules decide, never the update's: the form sends empty selections with every save.
  static AlertDefinitionPolicy ofUpdate(EventSubscription stored, EventSubscription updated) {
    AlertFilteringInput selections =
        hasSelections(updated.getInput()) ? updated.getInput() : stored.getInput();
    return of(updated.getAlertType(), selections, stored.getFilteringRules());
  }

  private static AlertDefinitionPolicy of(
      AlertType type, AlertFilteringInput selections, FilteringRules rules) {
    boolean compiledType = type == AlertType.NOTIFICATION || type == AlertType.OBSERVABILITY;
    boolean rulesWithoutSelections =
        !hasSelections(selections) && rules != null && !listOrEmpty(rules.getRules()).isEmpty();
    return compiledType && !rulesWithoutSelections ? new FromSelections() : new WrittenByHand();
  }

  private static boolean hasSelections(AlertFilteringInput input) {
    return input != null
        && !(listOrEmpty(input.getFilters()).isEmpty()
            && listOrEmpty(input.getActions()).isEmpty());
  }

  // A PUT replaces only what its body says, and one with no selections says nothing about them.
  private static void keepStoredSelectionsOnPut(
      EventSubscription stored, EventSubscription updated, boolean isPut) {
    if (isPut && updated.getInput() == null) {
      updated.setInput(stored.getInput());
    }
  }

  final class FromSelections implements AlertDefinitionPolicy {

    @Override
    public void prepareNew(EventSubscription alert) {
      alert.setFilteringRules(AlertDefinition.compileStrictly(alert));
      StoredRules.fillAbsentLists(alert);
      StoredRules.validate(alert);
    }

    @Override
    public void settle(EventSubscription stored, EventSubscription updated, boolean isPut) {
      keepStoredSelectionsOnPut(stored, updated, isPut);
      boolean changed = !AlertDefinition.isSameDefinition(stored, updated);
      updated.setFilteringRules(
          changed
              ? AlertDefinition.compileStrictly(updated)
              : AlertDefinition.compileOrKeep(updated, stored.getFilteringRules()));
      StoredRules.fillAbsentLists(updated);
      if (changed) {
        StoredRules.validate(updated);
      }
    }
  }

  final class WrittenByHand implements AlertDefinitionPolicy {

    @Override
    public void prepareNew(EventSubscription alert) {
      StoredRules.requireOneResource(alert.getFilteringRules());
      StoredRules.fillAbsentLists(alert);
      StoredRules.validate(alert);
    }

    // The body of a PUT has no place for rules, so it says nothing about them and they stay. A
    // PATCH can write them, and what it wrote is checked like any new rule.
    @Override
    public void settle(EventSubscription stored, EventSubscription updated, boolean isPut) {
      keepStoredSelectionsOnPut(stored, updated, isPut);
      FilteringRules storedRules = stored.getFilteringRules();
      FilteringRules sent = updated.getFilteringRules();
      StoredRules.requireOneResourceWhenChanged(storedRules, sent);
      boolean keepsStoredRules = isPut && sent != null && storedRules != null;
      if (keepsStoredRules) {
        sent.setRules(storedRules.getRules());
        sent.setActions(storedRules.getActions());
      }
      boolean wroteRules = !keepsStoredRules && sent != null && !sent.equals(storedRules);
      StoredRules.fillAbsentLists(updated);
      if (wroteRules) {
        StoredRules.validate(updated);
      }
    }
  }
}
