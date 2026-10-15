package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.TagIndex;

class SearchPartialUpdateTest {
  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testcase", Entity.TEST_CASE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testsuite", Entity.TEST_SUITE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("pipeline", Entity.PIPELINE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("query", Entity.QUERY);
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = "Documented asset")
  void descriptionUpdatesIncludeTheSameDerivedFieldsAsARebuild(final String description) {
    final Table table = table().withDescription(description);
    final ChangeDescription changes = updated(Entity.FIELD_DESCRIPTION, description);
    table.setChangeDescription(changes);

    final Map<String, Object> expected = commonDocument(table);
    final SearchDocumentUpdate update =
        SearchDocumentUpdates.buildScriptedPartialUpdate(table, changes, true);

    assertNotNull(update);
    assertEquals(expected.get("descriptionStatus"), update.parameters().get("descriptionStatus"));
    assertEquals(expected.get("descriptionSources"), update.parameters().get("descriptionSources"));
  }

  @Test
  void voteUpdatesIncludeTheSameCountsAsARebuild() {
    final Table table = table().withVotes(new Votes().withUpVotes(9).withDownVotes(3));
    final ChangeDescription changes = updated(Entity.FIELD_VOTES, table.getVotes());
    final Map<String, Object> expected = commonDocument(table);

    final SearchDocumentUpdate update =
        SearchDocumentUpdates.buildScriptedPartialUpdate(table, changes, true);

    assertNotNull(update);
    assertEquals(expected.get("votes"), update.parameters().get("votes"));
    assertEquals(expected.get("totalVotes"), update.parameters().get("totalVotes"));
  }

  @Test
  void followerDeletionRetainsEveryRemovedIdentity() {
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final ChangeDescription changes =
        new ChangeDescription()
            .withFieldsDeleted(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_FOLLOWERS)
                        .withOldValue(
                            List.of(
                                new EntityReference().withId(first),
                                new EntityReference().withId(second)))));

    final SearchDocumentUpdate update =
        SearchDocumentUpdates.buildScriptedPartialUpdate(table(), changes, true);

    assertNotNull(update);
    assertEquals(
        List.of(first.toString(), second.toString()), update.parameters().get("followersToRemove"));
  }

  @Test
  void deletingCustomPropertiesRemovesBothIndexedRepresentations() {
    final ChangeDescription changes =
        new ChangeDescription()
            .withFieldsDeleted(
                List.of(
                    new FieldChange().withName("extension").withOldValue(Map.of("old", "value"))));

    final SearchDocumentUpdate update =
        SearchDocumentUpdates.buildScriptedPartialUpdate(table(), changes, true);

    assertNotNull(update);
    assertTrue(update.script().contains("ctx._source.remove('extension')"));
    assertEquals(List.of(), update.parameters().get("customPropertiesTyped"));
  }

  @Test
  void unsupportedOrVersionedChangesRequireTheFullDocument() {
    assertNull(
        SearchDocumentUpdates.buildScriptedPartialUpdate(
            table(), updated("columns", List.of()), true));
    assertNull(
        SearchDocumentUpdates.buildScriptedPartialUpdate(
            table(), updated("description", "new"), false));
    assertNull(
        SearchDocumentUpdates.buildScriptedPartialUpdate(table(), new ChangeDescription(), true));
  }

  @Test
  void explicitNullRemovalsDoNotMutateTheInputDocument() {
    final Map<String, Object> input = new HashMap<>();
    input.put("name", "asset");
    input.put("description", null);
    input.put("fieldsToRemove", List.of("displayName"));

    final Map<String, Object> normalized =
        new SearchDocumentUpdate("script", input, true).parametersForIndexing();

    assertEquals(List.of("description", "displayName"), normalized.get("fieldsToRemove"));
    assertFalse(normalized.containsKey("description"));
    assertTrue(input.containsKey("description"));
  }

  @Test
  void multipleFollowerDeltasRetainAllAddedAndRemovedIds() {
    final EntityReference first = new EntityReference().withId(UUID.randomUUID());
    final EntityReference second = new EntityReference().withId(UUID.randomUUID());
    final var changes =
        new ChangeDescription()
            .withFieldsAdded(
                List.of(
                    new FieldChange().withName(Entity.FIELD_FOLLOWERS).withNewValue(List.of(first)),
                    new FieldChange()
                        .withName(Entity.FIELD_FOLLOWERS)
                        .withNewValue(List.of(second))))
            .withFieldsDeleted(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_FOLLOWERS)
                        .withOldValue(List.of(first))));
    final var update = SearchPartialUpdate.prepare(table(), changes);
    assertEquals(
        List.of(first.getId().toString(), second.getId().toString()),
        update.parameters().get("followersToAdd"));
    assertEquals(List.of(first.getId().toString()), update.parameters().get("followersToRemove"));
  }

  @Test
  void partialUpdatesCannotCreateAnIncompleteDocument() {
    final var update = SearchPartialUpdate.prepare(table(), updated(Entity.FIELD_VOTES, null));
    assertTrue(update.script().contains("ctx.op == 'create'"));
    assertTrue(update.script().contains("throw new IllegalStateException"));
  }

  @Test
  void missingVotesRemoveOldCountsAndResetRanking() {
    final var update = SearchPartialUpdate.prepare(table(), updated(Entity.FIELD_VOTES, null));
    assertEquals(0, update.parameters().get("totalVotes"));
    assertTrue(update.script().contains("remove('votes')"));
    final var zeroVotes =
        SearchPartialUpdate.prepare(
            table().withVotes(new Votes().withUpVotes(null).withDownVotes(null)),
            updated(Entity.FIELD_VOTES, null));
    assertEquals(Map.of("upVotes", 0, "downVotes", 0), zeroVotes.parameters().get("votes"));
  }

  @Test
  void usageAndPipelineStatusRetainTheirCanonicalPayloads() {
    final UsageDetails usage = new UsageDetails().withDate("2026-10-06");
    final var usageUpdate =
        SearchPartialUpdate.prepare(table(), updated(Entity.FIELD_USAGE_SUMMARY, usage));
    assertEquals(usage, usageUpdate.parameters().get(Entity.FIELD_USAGE_SUMMARY));
    final PipelineStatus status =
        new PipelineStatus().withExecutionId("execution").withTimestamp(100L);
    final Pipeline pipeline =
        new Pipeline().withId(UUID.randomUUID()).withName("pipeline").withPipelineStatus(status);
    final var pipelineUpdate =
        SearchPartialUpdate.prepare(pipeline, updated(Entity.FIELD_PIPELINE_STATUS, status));
    assertEquals(
        JsonUtils.getMap(status), pipelineUpdate.parameters().get(Entity.FIELD_PIPELINE_STATUS));
  }

  @Test
  void queryUsageAlsoRefreshesInheritedDomains() {
    final EntityReference domain =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN).withName("domain");
    final Query query =
        new Query().withId(UUID.randomUUID()).withName("query").withDomains(List.of(domain));
    final var update = SearchPartialUpdate.prepare(query, updated("queryUsedIn", List.of()));
    assertEquals(List.of(), update.parameters().get("queryUsedIn"));
    assertEquals(
        List.of(SearchIndexUtils.toEntityRefMap(domain)),
        update.parameters().get(Entity.FIELD_DOMAINS));
  }

  @ParameterizedTest
  @ValueSource(strings = {"votes", "usageSummary", "pipelineStatus", "queryUsedIn", "columns"})
  void unsupportedDeltaShapesCannotSilentlyDiscardAChange(final String field) {
    final var addition =
        new ChangeDescription().withFieldsAdded(List.of(new FieldChange().withName(field)));
    final var deletion =
        new ChangeDescription().withFieldsDeleted(List.of(new FieldChange().withName(field)));
    assertNull(SearchDocumentUpdates.buildScriptedPartialUpdate(table(), addition, true));
    assertNull(SearchDocumentUpdates.buildScriptedPartialUpdate(table(), deletion, true));
    assertThrows(
        IllegalArgumentException.class, () -> SearchPartialUpdate.prepare(table(), deletion));
  }

  @Test
  void incrementalChangesTakePrecedenceOverTheStoredVersionChange() {
    final var incremental = updated(Entity.FIELD_DESCRIPTION, "current");
    final Table table =
        table()
            .withChangeDescription(updated("name", "old"))
            .withIncrementalChangeDescription(incremental);
    assertEquals(incremental, SearchDocumentUpdates.getEffectiveChangeDescription(table));
  }

  private static Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("asset")
        .withFullyQualifiedName("service.db.schema.asset")
        .withColumns(List.of())
        .withVersion(1.0)
        .withUpdatedAt(100L);
  }

  @Test
  void descriptionAndExtensionChangesKeepBothRepresentations() {
    final Table table =
        table().withDescription("new description").withExtension(Map.of("reviewer", "alice"));
    final var changes =
        updated(Entity.FIELD_DESCRIPTION, "ignored")
            .withFieldsAdded(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_EXTENSION)
                        .withNewValue(table.getExtension())));
    final Map<String, Object> parameters = new HashMap<>();
    SearchDocumentUpdates.getScriptWithParams(table, parameters, changes);
    assertEquals(100L, parameters.get("updatedAt"));
    assertEquals("new description", parameters.get(Entity.FIELD_DESCRIPTION));
    assertEquals("COMPLETE", parameters.get("descriptionStatus"));
    assertEquals(Map.of("reviewer", "alice"), parameters.get(Entity.FIELD_EXTENSION));
    final List<?> properties = (List<?>) parameters.get("customPropertiesTyped");
    assertFalse(properties.isEmpty());
  }

  @Test
  void queryDomainsExcludeApiAndInheritanceOnlyFields() {
    final UUID id = UUID.randomUUID();
    final EntityReference domain =
        new EntityReference()
            .withId(id)
            .withType(Entity.DOMAIN)
            .withName("analytics")
            .withDisplayName("Analytics")
            .withFullyQualifiedName("analytics")
            .withDescription("Analytics domain")
            .withDeleted(false)
            .withInherited(true)
            .withHref(URI.create("http://localhost/api/v1/domains/analytics"));
    final Query query =
        new Query().withId(UUID.randomUUID()).withName("daily_query").withDomains(List.of(domain));
    final var update =
        SearchPartialUpdate.prepare(
            query, updated("queryUsedIn", List.of(Map.of("name", "dashboard"))));
    assertEquals(List.of(Map.of("name", "dashboard")), update.parameters().get("queryUsedIn"));
    assertEquals(
        List.of(
            Map.of(
                "id",
                id.toString(),
                "type",
                Entity.DOMAIN,
                "name",
                "analytics",
                "displayName",
                "Analytics",
                "fullyQualifiedName",
                "analytics",
                "description",
                "Analytics domain",
                "deleted",
                false)),
        update.parameters().get(Entity.FIELD_DOMAINS));
  }

  private static ChangeDescription updated(final String field, final Object value) {
    return new ChangeDescription()
        .withPreviousVersion(1.0)
        .withFieldsUpdated(List.of(new FieldChange().withName(field).withNewValue(value)));
  }

  private static Map<String, Object> commonDocument(final Table table) {
    final Map<String, Object> document = new HashMap<>();
    new TagIndex(null).populateCommonFields(document, table, Entity.TABLE);
    return document;
  }
}
