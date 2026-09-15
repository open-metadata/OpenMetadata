package org.openmetadata.service.entity.history;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.util.EntityUtil;

/** Supplies stored snapshots to the real history implementation for consumer tests. */
public final class EntityVersionHistoryFixture {
  private EntityVersionHistoryFixture() {}

  public static <T extends EntityInterface> EntityVersionHistory<T> versions(
      String type, Class<T> entityClass, T current, List<T> snapshots) {
    final EntityExtensionDAO extensions = mock(EntityExtensionDAO.class);
    final List<ExtensionRecord> rows =
        snapshots.stream()
            .map(
                snapshot ->
                    new ExtensionRecord(
                        EntityUtil.getVersionExtension(type, snapshot.getVersion()),
                        JsonUtils.pojoToJson(snapshot)))
            .toList();
    when(extensions.getExtensions(current.getId(), EntityUtil.getVersionExtensionPrefix(type)))
        .thenReturn(rows);
    return new EntityVersionHistory<>(
        new EntityHistoryType<>(type, entityClass, null),
        () -> extensions,
        id -> {
          if (!current.getId().equals(id)) {
            throw EntityNotFoundException.byId(id.toString());
          }
          return current;
        },
        new EntityVersionHistory.Hydration<>(entity -> entity, entity -> {}));
  }
}
