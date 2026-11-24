package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.jdbi3.TableRepository.FAILED_ROWS_COLUMN_REMOVALS_EXTENSION;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsGracefully;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.security.mask.FailedRowsSamplePolicy;
import org.openmetadata.service.security.mask.FailedRowsSamplePolicy.RemovalRecord;
import org.openmetadata.service.util.FullyQualifiedName;

/** Transaction-local persistence for failed-row source associations and removal evidence. */
final class FailedRowsSampleStore {
  private final CollectionDAO dao;

  FailedRowsSampleStore(CollectionDAO dao) {
    this.dao = dao;
  }

  Table lockTable(UUID id) {
    String json = dao.tableDAO().findJsonByIdForUpdate(id, ALL);
    if (json == null) {
      throw new EntityNotFoundException("Failed-row source table not found: " + id);
    }
    Table table = JsonUtils.readValue(json, Table.class);
    // Certification presentation filters must not hide labels from the private masking policy.
    Map<String, List<TagLabel>> shownTags =
        dao.tagUsageDAO().getTagsByPrefix(table.getFullyQualifiedName(), "%", true);
    populateEntityFieldTags(table.getColumns(), table.getFullyQualifiedName(), true, shownTags);
    table.setTags(
        addDerivedTagsGracefully(
            listOrEmpty(
                shownTags.get(FullyQualifiedName.buildHash(table.getFullyQualifiedName())))));
    return table;
  }

  RemovalRecord readRemovals(UUID id) {
    String json =
        dao.entityExtensionDAO().getExtensionForUpdate(id, FAILED_ROWS_COLUMN_REMOVALS_EXTENSION);
    return json == null
        ? FailedRowsSamplePolicy.emptyRecord()
        : FailedRowsSamplePolicy.decodeRemovalRecord(json);
  }

  void captureRemoval(Table original, Table updated) {
    Table current = lockTable(original.getId());
    RemovalRecord record = readRemovals(current.getId());
    RemovalRecord appended = FailedRowsSamplePolicy.append(record, current, updated);
    if (record.sequence().equals(appended.sequence())) {
      return;
    }
    if (!FailedRowsSamplePolicy.sameBaseline(original, current)) {
      throw new PreconditionFailedException(
          "The table source columns or classification changed. Please refresh and retry.");
    }
    dao.entityExtensionDAO()
        .insert(
            current.getId(),
            FAILED_ROWS_COLUMN_REMOVALS_EXTENSION,
            FAILED_ROWS_COLUMN_REMOVALS_EXTENSION,
            JsonUtils.pojoToJson(appended));
  }
}
