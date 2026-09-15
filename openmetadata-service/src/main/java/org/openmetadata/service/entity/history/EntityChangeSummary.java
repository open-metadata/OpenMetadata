package org.openmetadata.service.entity.history;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;

/** Merges attribution into a private summary while retaining unmodified field history. */
public final class EntityChangeSummary<T extends EntityInterface> {
  private final ChangeSummarizer<T> summarizer;

  public EntityChangeSummary(final ChangeSummarizer<T> summarizer) {
    this.summarizer = summarizer;
  }

  public void update(
      final T original,
      final T updated,
      final ChangeDescription changes,
      final ChangeSource source) {
    if (!isNullOrEmptyChangeDescription(changes)) {
      final ChangeSummaryMap summary = copySummary(original);
      changes.setChangeSummary(summary);
      summary
          .getAdditionalProperties()
          .putAll(
              summarizer.summarizeChanges(
                  summary.getAdditionalProperties(),
                  changedFields(changes),
                  source,
                  updated.getUpdatedBy(),
                  updated.getUpdatedAt()));
      summarizer
          .processDeleted(listOrEmpty(changes.getFieldsDeleted()))
          .forEach(summary.getAdditionalProperties()::remove);
    }
  }

  private ChangeSummaryMap copySummary(final T original) {
    return Optional.ofNullable(original.getChangeDescription())
        .map(ChangeDescription::getChangeSummary)
        .map(summary -> JsonUtils.deepCopy(summary, ChangeSummaryMap.class))
        .orElseGet(ChangeSummaryMap::new);
  }

  private List<FieldChange> changedFields(final ChangeDescription changes) {
    final List<FieldChange> fields = new ArrayList<>(listOrEmpty(changes.getFieldsUpdated()));
    fields.addAll(listOrEmpty(changes.getFieldsAdded()));
    return fields;
  }
}
