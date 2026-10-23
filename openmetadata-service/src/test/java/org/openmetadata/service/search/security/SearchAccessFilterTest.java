package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class SearchAccessFilterTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final SearchAccessFilter accessFilter =
      new SearchAccessFilter(new OpenSearchQueryBuilderFactory());
  private MockedStatic<SettingsCache> settingsCache;

  @BeforeEach
  void setUp() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getIndexOrAliasName(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
    when(searchRepository.getChildIndexAliases(anyString())).thenReturn(Collections.emptyList());
    Entity.setSearchRepository(searchRepository);
    settingsCache = mockStatic(SettingsCache.class);
    accessControl(true);
  }

  @AfterEach
  void tearDown() {
    settingsCache.close();
    Entity.setSearchRepository(null);
  }

  private void accessControl(boolean enabled) {
    SearchSettings settings =
        new SearchSettings()
            .withGlobalSettings(new GlobalSettings().withEnableAccessControl(enabled));
    settingsCache
        .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
        .thenReturn(settings);
  }

  private static CompiledRule rule(CompiledRule.Effect effect, List<String> resources) {
    CompiledRule rule = mock(CompiledRule.class);
    when(rule.getOperations()).thenReturn(List.of(MetadataOperation.VIEW_ALL));
    when(rule.getEffect()).thenReturn(effect);
    when(rule.getResources()).thenReturn(resources);
    return rule;
  }

  private static SubjectContext subject(boolean admin, boolean bot, CompiledRule... rules) {
    SubjectContext.PolicyContext policy = mock(SubjectContext.PolicyContext.class);
    when(policy.getRules()).thenReturn(List.of(rules));
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.user()).thenReturn(new User().withId(UUID.randomUUID()).withName("reader"));
    when(subject.isAdmin()).thenReturn(admin);
    when(subject.isBot()).thenReturn(bot);
    when(subject.getPolicies(any())).thenAnswer(invocation -> List.of(policy).iterator());
    return subject;
  }

  /** The seeded DataConsumer and Organization grants: ViewAll on resource "all". */
  private static SubjectContext dataConsumer() {
    return subject(false, false, rule(CompiledRule.Effect.ALLOW, List.of("all")));
  }

  private static SubjectContext deniedTables() {
    return subject(
        false,
        false,
        rule(CompiledRule.Effect.ALLOW, List.of("all")),
        rule(CompiledRule.Effect.DENY, List.of("table")));
  }

  private static JsonNode json(OMQueryBuilder filter) throws Exception {
    return MAPPER.readTree(((OpenSearchQueryBuilder) filter).build().toJsonString());
  }

  private static JsonNode entityBranch(JsonNode filter) {
    return filter.path("bool").path("should").get(0);
  }

  private static JsonNode chunkBranch(JsonNode filter) {
    return filter.path("bool").path("should").get(1);
  }

  private static boolean hasExists(JsonNode clauses, String field) {
    boolean found = false;
    for (JsonNode clause : clauses) {
      found |= field.equals(clause.path("exists").path("field").asText());
    }
    return found;
  }

  @Test
  void noFilterWhenAccessControlOff() {
    accessControl(false);

    assertNull(accessFilter.build(deniedTables()));
  }

  @Test
  void noFilterForAdmin() {
    assertNull(
        accessFilter.build(subject(true, false, rule(CompiledRule.Effect.DENY, List.of("table")))));
  }

  @Test
  void botIsFiltered() {
    assertNotNull(
        accessFilter.build(subject(false, true, rule(CompiledRule.Effect.DENY, List.of("table")))));
  }

  @Test
  void branchesSplitOnIdExistence() throws Exception {
    JsonNode filter = json(accessFilter.build(deniedTables()));

    assertTrue(
        hasExists(entityBranch(filter).path("bool").path("filter"), SearchAccessFilter.FIELD_ID));
    assertTrue(
        hasExists(chunkBranch(filter).path("bool").path("must_not"), SearchAccessFilter.FIELD_ID));
  }

  /** A security constraint must never add to a hit's score, whatever context a caller puts it in. */
  @Test
  void branchesConstrainWithoutScoring() throws Exception {
    JsonNode filter = json(accessFilter.build(deniedTables()));

    for (JsonNode branch : List.of(entityBranch(filter), chunkBranch(filter))) {
      assertTrue(branch.path("bool").path("must").isMissingNode(), branch.toString());
      assertFalse(branch.path("bool").path("filter").isEmpty(), branch.toString());
    }
  }

  /**
   * A plain Data Consumer may see every chunk, so chunks written before they carried access fields
   * stay visible: nothing to evaluate means nothing to withhold.
   */
  @Test
  void dataConsumerKeepsPreUpgradeChunks() throws Exception {
    JsonNode filter = json(accessFilter.build(dataConsumer()));

    assertFalse(
        hasExists(
            chunkBranch(filter).path("bool").path("filter"), VectorDocBuilder.FIELD_ACCESS_STAMP),
        filter.toString());
    assertTrue(entityBranch(filter).toString().contains("_index"), filter.toString());
  }

  @Test
  void restrictedCallerNeedsAccessStamp() throws Exception {
    JsonNode chunk = chunkBranch(json(accessFilter.build(deniedTables())));

    assertTrue(
        hasExists(chunk.path("bool").path("filter"), VectorDocBuilder.FIELD_ACCESS_STAMP),
        chunk.toString());
    assertTrue(chunk.toString().contains("\"entityType\":[\"table\"]"), chunk.toString());
    assertFalse(chunk.toString().contains("_index"), chunk.toString());
  }
}
