package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.settings.SettingsCache;

class QueryRepositoryTest {

  @Test
  void addQueryUsageTriggersPostUpdate() {
    UUID queryId = UUID.randomUUID();
    EntityReference tableRef = entityReference("table", "datatypes");
    Query query = query(queryId);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<RdfUpdater> ignoredRdfUpdater = mockStatic(RdfUpdater.class);
        MockedStatic<EntityLifecycleEventDispatcher> lifecycleDispatcherMock =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<OpenMetadataApplicationConfigHolder> configHolder =
            mockStatic(OpenMetadataApplicationConfigHolder.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      EntityLifecycleEventDispatcher lifecycleDispatcher =
          mock(EntityLifecycleEventDispatcher.class);
      EntityRelationshipRepository relationshipRepository =
          mock(EntityRelationshipRepository.class);
      QueryRepository repository = createRepo(entityMock, relationshipRepository);
      mockHrefResolution(configHolder, settingsCache);
      lifecycleDispatcherMock
          .when(EntityLifecycleEventDispatcher::getInstance)
          .thenReturn(lifecycleDispatcher);

      entityMock
          .when(() -> Entity.getEntity(Entity.QUERY, queryId, "queryUsedIn", Include.NON_DELETED))
          .thenReturn(query);
      when(relationshipRepository.getEntityReferences(any(), eq(Include.NON_DELETED)))
          .thenReturn(List.of(tableRef));

      Response response =
          repository
              .addQueryUsage(uriInfo(), "ingestion-bot", queryId, List.of(tableRef))
              .toResponse();
      ChangeEvent changeEvent = (ChangeEvent) response.getEntity();

      assertChangeEvent(changeEvent, null, List.of(tableRef));
      assertEquals(changeEvent.getChangeDescription(), query.getChangeDescription());
      assertEquals(changeEvent.getChangeDescription(), query.getIncrementalChangeDescription());
      verify(lifecycleDispatcher).onEntityUpdated(query, query.getChangeDescription(), null);
    }
  }

  @Test
  void removeQueryUsedInTriggersPostUpdate() {
    UUID queryId = UUID.randomUUID();
    EntityReference tableRef = entityReference("table", "datatypes");
    Query query = query(queryId).withQueryUsedIn(List.of(tableRef));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<RdfUpdater> ignoredRdfUpdater = mockStatic(RdfUpdater.class);
        MockedStatic<EntityLifecycleEventDispatcher> lifecycleDispatcherMock =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<OpenMetadataApplicationConfigHolder> configHolder =
            mockStatic(OpenMetadataApplicationConfigHolder.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      EntityLifecycleEventDispatcher lifecycleDispatcher =
          mock(EntityLifecycleEventDispatcher.class);
      EntityRelationshipRepository relationshipRepository =
          mock(EntityRelationshipRepository.class);
      QueryRepository repository = createRepo(entityMock, relationshipRepository);
      mockHrefResolution(configHolder, settingsCache);
      lifecycleDispatcherMock
          .when(EntityLifecycleEventDispatcher::getInstance)
          .thenReturn(lifecycleDispatcher);

      entityMock
          .when(() -> Entity.getEntity(Entity.QUERY, queryId, "queryUsedIn", Include.NON_DELETED))
          .thenReturn(query);
      when(relationshipRepository.getEntityReferences(any(), eq(Include.NON_DELETED)))
          .thenReturn(List.of());

      Response response =
          repository
              .removeQueryUsedIn(uriInfo(), "ingestion-bot", queryId, List.of(tableRef))
              .toResponse();
      ChangeEvent changeEvent = (ChangeEvent) response.getEntity();

      assertChangeEvent(changeEvent, List.of(tableRef), List.of());
      assertEquals(changeEvent.getChangeDescription(), query.getChangeDescription());
      assertEquals(changeEvent.getChangeDescription(), query.getIncrementalChangeDescription());
      verify(lifecycleDispatcher).onEntityUpdated(query, query.getChangeDescription(), null);
    }
  }

  private void assertChangeEvent(
      ChangeEvent changeEvent,
      List<EntityReference> expectedOldValue,
      List<EntityReference> expectedNewValue) {
    assertNotNull(changeEvent);
    assertNotNull(changeEvent.getChangeDescription());
    assertEquals(1, changeEvent.getChangeDescription().getFieldsUpdated().size());
    assertEquals(
        "queryUsedIn", changeEvent.getChangeDescription().getFieldsUpdated().getFirst().getName());
    assertEquals(
        expectedOldValue,
        changeEvent.getChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertEquals(
        expectedNewValue,
        changeEvent.getChangeDescription().getFieldsUpdated().getFirst().getNewValue());
  }

  private QueryRepository createRepo(
      MockedStatic<Entity> entityMock, EntityRelationshipRepository relationshipRepository) {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.QueryDAO queryDAO = mock(CollectionDAO.QueryDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);

    when(dao.queryDAO()).thenReturn(queryDAO);
    when(dao.relationshipDAO()).thenReturn(relationshipDAO);

    entityMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityMock.when(Entity::getEntityRelationshipRepository).thenReturn(relationshipRepository);
    entityMock
        .when(() -> Entity.registerResourcePermissions(Entity.QUERY, null))
        .thenAnswer(invocation -> null);
    entityMock
        .when(() -> Entity.registerResourceFieldViewMapping(Entity.QUERY, null))
        .thenAnswer(invocation -> null);
    entityMock
        .when(() -> Entity.getEntityFields(Query.class))
        .thenReturn(
            Set.of(
                "id",
                "name",
                "fullyQualifiedName",
                "version",
                "updatedAt",
                "updatedBy",
                "href",
                "query",
                "queryUsedIn",
                "users",
                "usedBy",
                "service",
                "processedLineage",
                "changeDescription",
                "incrementalChangeDescription"));

    return new QueryRepository();
  }

  private Query query(UUID id) {
    return new Query()
        .withId(id)
        .withName("query")
        .withFullyQualifiedName("local_exasol.query")
        .withVersion(0.1)
        .withUpdatedBy("ingestion-bot")
        // Query.usedBy is modeled as a Set<String> in the generated schema.
        .withUsedBy(Set.of());
  }

  private EntityReference entityReference(String type, String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(fqn)
        .withFullyQualifiedName(fqn);
  }

  private UriInfo uriInfo() {
    UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getBaseUri()).thenReturn(URI.create("http://localhost:8585/api/v1/"));
    return uriInfo;
  }

  private void mockHrefResolution(
      MockedStatic<OpenMetadataApplicationConfigHolder> configHolder,
      MockedStatic<SettingsCache> settingsCache) {
    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    when(config.getApiRootPath()).thenReturn("/api/v1/");
    configHolder.when(OpenMetadataApplicationConfigHolder::getInstance).thenReturn(config);
    settingsCache
        .when(
            () ->
                SettingsCache.getSetting(
                    SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
                    OpenMetadataBaseUrlConfiguration.class))
        .thenReturn(new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(" "));
  }
}
