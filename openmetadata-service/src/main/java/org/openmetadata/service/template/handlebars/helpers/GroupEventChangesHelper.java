package org.openmetadata.service.template.handlebars.helpers;

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
import org.openmetadata.service.template.handlebars.HandlebarsHelper;

/**
 * Helper to group change events by merging adds/deletes into updates where applicable. This
 * matches the logic in FormatterUtil.getFormattedMessages() to ensure consistent change grouping.
 *
 * <p>Template usage: {{#with (groupEventChanges event.changeDescription) as |changes|}} {{#if
 * changes.updates}}...{{/if}} {{#if changes.adds}}...{{/if}} {{#if changes.deletes}}...{{/if}}
 * {{/with}}
 */
public class GroupEventChangesHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "groupEventChanges";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (Helper<ChangeDescription>)
            (changeDesc, options) -> {
              // Null-safe extraction
              final List<FieldChange> fieldsUpdated =
                  Optional.ofNullable(changeDesc)
                      .map(ChangeDescription::getFieldsUpdated)
                      .orElse(List.of());
              final List<FieldChange> fieldsAddedSrc =
                  Optional.ofNullable(changeDesc)
                      .map(ChangeDescription::getFieldsAdded)
                      .orElse(List.of());
              final List<FieldChange> fieldsDeleted =
                  Optional.ofNullable(changeDesc)
                      .map(ChangeDescription::getFieldsDeleted)
                      .orElse(List.of());

              // Per-name queues of ADDED in source order (support duplicate names)
              record Indexed<T>(T value, int index) {}
              final Map<String, Deque<Indexed<FieldChange>>> addedQueues = new LinkedHashMap<>();
              for (int i = 0; i < fieldsAddedSrc.size(); i++) {
                final FieldChange fc = fieldsAddedSrc.get(i);
                addedQueues
                    .computeIfAbsent(fc.getName(), k -> new ArrayDeque<>())
                    .addLast(new Indexed<>(fc, i));
              }

              // Track consumed ADDED indices to preserve original add-order for leftovers
              final BitSet consumedAddedIdx = new BitSet(fieldsAddedSrc.size());

              // Output groups (each item is a FieldChange)
              final List<FieldChange> updates = new ArrayList<>();
              final List<FieldChange> deletes = new ArrayList<>();
              final List<FieldChange> adds = new ArrayList<>();

              // 1) Direct UPDATEs (unchanged order)
              for (FieldChange u : fieldsUpdated) {
                updates.add(
                    new FieldChange()
                        .withName(u.getName())
                        .withOldValue(u.getOldValue())
                        .withNewValue(u.getNewValue()));
              }

              // 2) For each DELETE: merge with first matching ADD -> UPDATE; else -> DELETE
              for (FieldChange d : fieldsDeleted) {
                final Deque<Indexed<FieldChange>> queue = addedQueues.get(d.getName());
                if (queue != null && !queue.isEmpty()) {
                  // First match wins
                  final Indexed<FieldChange> consumed = queue.removeFirst();
                  final FieldChange matchedAdd = consumed.value();
                  consumedAddedIdx.set(consumed.index());

                  // IMPORTANT: remove ALL additional ADDED entries equal to the matched one
                  queue.removeIf(
                      ix -> {
                        if (Objects.equals(ix.value(), matchedAdd)) {
                          consumedAddedIdx.set(ix.index());
                          return true;
                        }
                        return false;
                      });

                  // Merged UPDATE: old from delete, new from add
                  updates.add(
                      new FieldChange()
                          .withName(d.getName())
                          .withOldValue(d.getOldValue())
                          .withNewValue(matchedAdd.getNewValue()));
                } else {
                  // Unmatched DELETE
                  deletes.add(
                      new FieldChange()
                          .withName(d.getName())
                          .withOldValue(d.getOldValue())
                          .withNewValue(null));
                }
              }

              // 3) Remaining ADDs in original insertion order
              for (int i = 0; i < fieldsAddedSrc.size(); i++) {
                if (!consumedAddedIdx.get(i)) {
                  final FieldChange a = fieldsAddedSrc.get(i);
                  adds.add(
                      new FieldChange()
                          .withName(a.getName())
                          .withOldValue(null)
                          .withNewValue(a.getNewValue()));
                }
              }

              return new ChangeGroups(updates, adds, deletes);
            });
  }

  /**
   * Container for grouped changes that the template can access
   */
  public record ChangeGroups(
      List<FieldChange> updates, List<FieldChange> adds, List<FieldChange> deletes) {}
}
