package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.populateEntityFieldTags;

import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.security.mask.FailedRowsSamplePolicy;
import org.openmetadata.service.security.mask.FailedRowsSamplePolicy.RemovalRecord;

/** Transaction-local persistence for failed-row source associations and removal evidence. */
final class FailedRowsSampleStore {
  static final String REMOVALS_EXTENSION = "table.failedRowsColumnRemovals";
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
    populateEntityFieldTags(TABLE, table.getColumns(), table.getFullyQualifiedName(), true);
    table.setTags(Entity.getEntityRepository(TABLE).getTags(table.getFullyQualifiedName()));
    return table;
  }

  RemovalRecord readRemovals(UUID id) {
    String json = dao.entityExtensionDAO().getExtensionForUpdate(id, REMOVALS_EXTENSION);
    return json == null
        ? FailedRowsSamplePolicy.emptyRecord()
        : FailedRowsSamplePolicy.decodeRemovalRecord(json);
  }

  void captureRemoval(Table original, Table updated) {
    Table current = lockTable(original.getId());
    if (!FailedRowsSamplePolicy.sameBaseline(original, current)) {
      throw new PreconditionFailedException(
          "The table source columns or classification changed. Please refresh and retry.");
    }
    RemovalRecord record = readRemovals(current.getId());
    RemovalRecord appended = FailedRowsSamplePolicy.append(record, current, updated);
    if (!record.sequence().equals(appended.sequence())) {
      dao.entityExtensionDAO()
          .insert(
              current.getId(),
              REMOVALS_EXTENSION,
              REMOVALS_EXTENSION,
              JsonUtils.pojoToJson(appended));
    }
  }
}
