package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityUpdateStore;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;

class EntityHistoryServicesTest {
  private static final UUID ID = UUID.randomUUID();
  private static final String ARCHIVED = "archived metadata";
  private static final String CURRENT = "current metadata";

  @Test
  void historyWritesAndReadsShareCanonicalStorageWithoutHydratingArchivedFields() {
    final var dao = extensions(new HashMap<>());
    final var services = services(new AtomicReference<>(dao));
    services
        .versionStore()
        .insert(new Table().withId(ID).withVersion(0.1).withDescription(ARCHIVED));
    final Table archived = services.versions().getVersion(ID, "0.1");
    assertEquals(ARCHIVED, archived.getDescription());
    assertEquals("stored", archived.getDisplayName());
    assertEquals(CURRENT, services.versions().getVersion(ID, "0.2").getDescription());
  }

  @Test
  void aNewTransactionResolvesItsOwnExtensionDaoForReadsAndWrites() {
    final var first = new HashMap<String, String>();
    final var second = new HashMap<String, String>();
    final var active = new AtomicReference<>(extensions(first));
    final var services = services(active);
    services
        .versionStore()
        .insert(new Table().withId(ID).withVersion(0.1).withDescription(ARCHIVED));
    active.set(extensions(second));
    services
        .versionStore()
        .insert(new Table().withId(ID).withVersion(0.1).withDescription(CURRENT));
    assertEquals(CURRENT, services.versions().getVersion(ID, "0.1").getDescription());
    active.set(extensions(first));
    assertEquals(ARCHIVED, services.versions().getVersion(ID, "0.1").getDescription());
  }

  private static EntityHistoryServices<Table> services(AtomicReference<EntityExtensionDAO> active) {
    return new EntityHistoryServices<>(
        new EntityHistoryType<>("table", Table.class, "table_entity"),
        new EntityHistoryServices.Storage<>(
            active::get,
            table -> JsonUtils.pojoToJson(table.withDisplayName("stored")),
            new EntityUpdateStore.Rows<>(table -> {}, (table, version) -> {})),
        new EntityHistoryServices.Hydration<>(
            id -> new Table().withId(id).withVersion(0.2),
            new EntityVersionHistory.Hydration<>(
                table -> table.withDescription(CURRENT), table -> {}),
            tables -> tables.forEach(table -> table.setDescription(CURRENT))),
        new EntityHistoryServices.Changes(Set.of("description"), () -> 1000L));
  }

  private static EntityExtensionDAO extensions(Map<String, String> rows) {
    final EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
    doAnswer(
            call -> {
              rows.put(call.getArgument(1), call.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(any(UUID.class), anyString(), anyString(), anyString());
    when(dao.getExtension(any(UUID.class), anyString()))
        .thenAnswer(call -> rows.get(call.getArgument(1)));
    return dao;
  }
}
