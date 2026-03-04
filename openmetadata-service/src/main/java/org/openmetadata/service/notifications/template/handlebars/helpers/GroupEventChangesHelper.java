/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to group change events by merging adds/deletes into updates where applicable.
 * Matches FormatterUtil.getFormattedMessages() grouping.
 *
 * Template usage:
 *   {{#with (groupEventChanges event.changeDescription) as |changes|}}
 *     {{#if changes.updates}}...{{/if}}
 *     {{#if changes.adds}}...{{/if}}
 *     {{#if changes.deletes}}...{{/if}}
 *   {{/with}}
 */
public class GroupEventChangesHelper implements HandlebarsHelper {

  private record Indexed<T>(T value, int index) {}

  private record MatchResult(List<FieldChange> mergedUpdates, BitSet matchedDeleteIdx) {}

  @Override
  public String getName() {
    return "groupEventChanges";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(), (Helper<ChangeDescription>) (changeDesc, options) -> groupChanges(changeDesc));
  }

  private ChangeGroups groupChanges(ChangeDescription changeDesc) {
    // Extract all field changes from the change description
    final List<FieldChange> fieldsUpdated = extractFieldsUpdated(changeDesc);
    final List<FieldChange> fieldsAdded = extractFieldsAdded(changeDesc);
    final List<FieldChange> fieldsDeleted = extractFieldsDeleted(changeDesc);

    // Build the initial update list from direct updates
    final List<FieldChange> updates = new ArrayList<>(buildDirectUpdates(fieldsUpdated));

    // Build indexed queues for efficient lookup of adds by field name
    final Map<String, Deque<Indexed<FieldChange>>> addedQueues = buildAddedQueues(fieldsAdded);
    final BitSet consumedAddedIdx = new BitSet(fieldsAdded.size());

    // Match deletes with adds to create merged updates
    final MatchResult matchResult =
        matchDeletesWithAdds(fieldsDeleted, addedQueues, consumedAddedIdx);

    // Collect unmatched deletes
    final List<FieldChange> unmatchedDeletes =
        collectUnmatchedDeletes(fieldsDeleted, matchResult.matchedDeleteIdx());

    // Collect remaining adds that weren't consumed
    final List<FieldChange> remainingAdds = collectRemainingAdds(fieldsAdded, consumedAddedIdx);

    // Combine all updates (direct + merged)
    updates.addAll(matchResult.mergedUpdates());

    return new ChangeGroups(updates, remainingAdds, unmatchedDeletes);
  }

  private List<FieldChange> buildDirectUpdates(List<FieldChange> fieldsUpdated) {
    return fieldsUpdated.stream()
        .map(
            u ->
                new FieldChange()
                    .withName(u.getName())
                    .withOldValue(u.getOldValue())
                    .withNewValue(u.getNewValue()))
        .toList();
  }

  private MatchResult matchDeletesWithAdds(
      List<FieldChange> fieldsDeleted,
      Map<String, Deque<Indexed<FieldChange>>> addedQueues,
      BitSet consumedAddedIdx) {

    final List<FieldChange> mergedUpdates = new ArrayList<>();
    final BitSet matchedDeleteIdx = new BitSet(fieldsDeleted.size());

    for (int i = 0; i < fieldsDeleted.size(); i++) {
      final FieldChange delete = fieldsDeleted.get(i);
      final Deque<Indexed<FieldChange>> queue = addedQueues.get(delete.getName());
      if (queue != null && !queue.isEmpty()) {
        // Found matching add - consume it and create merged update
        final Indexed<FieldChange> consumed = queue.removeFirst();
        final FieldChange matchedAdd = consumed.value();
        consumedAddedIdx.set(consumed.index());

        // Mark all duplicate adds as consumed
        markDuplicatesAsConsumed(queue, matchedAdd, consumedAddedIdx);

        // Create merged update
        mergedUpdates.add(
            new FieldChange()
                .withName(delete.getName())
                .withOldValue(delete.getOldValue())
                .withNewValue(matchedAdd.getNewValue()));

        matchedDeleteIdx.set(i); // Remember this delete was matched
      }
    }

    return new MatchResult(mergedUpdates, matchedDeleteIdx);
  }

  private List<FieldChange> collectUnmatchedDeletes(
      List<FieldChange> fieldsDeleted, BitSet matchedDeleteIdx) {

    final List<FieldChange> unmatchedDeletes = new ArrayList<>();

    for (int i = 0; i < fieldsDeleted.size(); i++) {
      if (!matchedDeleteIdx.get(i)) {
        final FieldChange delete = fieldsDeleted.get(i);
        unmatchedDeletes.add(
            new FieldChange()
                .withName(delete.getName())
                .withOldValue(delete.getOldValue())
                .withNewValue(delete.getNewValue()));
      }
    }

    return unmatchedDeletes;
  }

  private List<FieldChange> collectRemainingAdds(
      List<FieldChange> fieldsAdded, BitSet consumedAddedIdx) {

    final List<FieldChange> remainingAdds = new ArrayList<>();

    for (int i = 0; i < fieldsAdded.size(); i++) {
      if (!consumedAddedIdx.get(i)) {
        final FieldChange add = fieldsAdded.get(i);
        remainingAdds.add(
            new FieldChange()
                .withName(add.getName())
                .withOldValue(null)
                .withNewValue(add.getNewValue()));
      }
    }

    return remainingAdds;
  }

  private void markDuplicatesAsConsumed(
      Deque<Indexed<FieldChange>> queue, FieldChange matchedAdd, BitSet consumedAddedIdx) {

    queue.removeIf(
        ix -> {
          if (Objects.equals(ix.value(), matchedAdd)) {
            consumedAddedIdx.set(ix.index());
            return true;
          }
          return false;
        });
  }

  private List<FieldChange> extractFieldsUpdated(ChangeDescription changeDesc) {
    return Optional.ofNullable(changeDesc)
        .map(ChangeDescription::getFieldsUpdated)
        .orElse(List.of());
  }

  private List<FieldChange> extractFieldsAdded(ChangeDescription changeDesc) {
    return Optional.ofNullable(changeDesc).map(ChangeDescription::getFieldsAdded).orElse(List.of());
  }

  private List<FieldChange> extractFieldsDeleted(ChangeDescription changeDesc) {
    return Optional.ofNullable(changeDesc)
        .map(ChangeDescription::getFieldsDeleted)
        .orElse(List.of());
  }

  private Map<String, Deque<Indexed<FieldChange>>> buildAddedQueues(List<FieldChange> fieldsAdded) {
    final Map<String, Deque<Indexed<FieldChange>>> addedQueues = new LinkedHashMap<>();
    for (int i = 0; i < fieldsAdded.size(); i++) {
      final FieldChange fc = fieldsAdded.get(i);
      addedQueues
          .computeIfAbsent(fc.getName(), k -> new ArrayDeque<>())
          .addLast(new Indexed<>(fc, i));
    }
    return addedQueues;
  }

  /**
   * Container for grouped changes that the template can access
   */
  public record ChangeGroups(
      List<FieldChange> updates, List<FieldChange> adds, List<FieldChange> deletes) {}

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("groupEventChanges")
        .withDescription("Group change event fields by category")
        .withCursorOffset(20)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{groupEventChanges }}")
                    .withExample(
                        "{{#with (groupEventChanges event.changeDescription) as |grouped|}}{{#if grouped.updates}}Updates: {{grouped.updates}}{{/if}}{{/with}}")));
  }
}
