/*
 *  Copyright 2025 Collate
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

package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ForbiddenException;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Pins {@link GetEntityTool#cleanEntityResponse}. The entity-level description must always be
 * returned in full (this is the detail tool — the one place full text is reachable after search
 * truncates), while per-column descriptions, schema DDL and dbt SQL — the wide-table multipliers —
 * are truncated. The {@code extension} field (custom properties, #28594 contract) must survive at
 * both table and column level.
 */
class GetEntityToolTest {
  static final String GIT_TOKEN = "ghp_rawGitToken123";
  static final String SIGNING_KEY = "rawPgpPrivateKeyMaterial";
  static final String SIGNING_PASSPHRASE = "rawSigningPassphrase";

  @Test
  void contentOnlyPreservesViewBasicAuthorization() throws Exception {
    String fqn = "Knowledge.Article";
    Page page =
        new Page()
            .withId(java.util.UUID.randomUUID())
            .withName("Article")
            .withFullyQualifiedName(fqn)
            .withDescription("full article body");
    Authorizer authorizer = mock(Authorizer.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    Map<String, Object> result;

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityByName(Entity.PAGE, fqn, "", Include.NON_DELETED))
          .thenReturn(page);
      result =
          new GetEntityTool()
              .execute(
                  authorizer,
                  securityContext,
                  Map.of("entityType", Entity.PAGE, "fqn", fqn, "include", List.of("content")));
    }

    ArgumentCaptor<OperationContext> operation = ArgumentCaptor.forClass(OperationContext.class);
    ArgumentCaptor<ResourceContextInterface> resource =
        ArgumentCaptor.forClass(ResourceContextInterface.class);
    verify(authorizer, times(1)).authorize(any(), operation.capture(), resource.capture());
    assertEquals(
        List.of(MetadataOperation.VIEW_BASIC),
        operation.getValue().getOperations(resource.getValue()));
    assertEquals(Entity.PAGE, result.get("entityType"));
    assertEquals(fqn, result.get("fullyQualifiedName"));
    assertThat(castMap(result.get("content")).get("content")).isEqualTo("full article body");
    assertThat(result).doesNotContainKey("description");
  }

  /**
   * A context memory's visibility comes from its own shareConfig rather than from a role or policy,
   * so a read by name applies that rule on top of the operation check - the same answer the REST
   * endpoint gives.
   */
  @Test
  void plainReadDeniesAnotherUsersPrivateMemory() {
    String fqn = "alices-private-note";
    ContextMemory memory = privateMemoryOwnedBy("alice", fqn);
    CatalogSecurityContext securityContext = securityContextFor("bob");

    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      entities
          .when(
              () -> Entity.getEntityByName(eq(Entity.CONTEXT_MEMORY), eq(fqn), anyString(), any()))
          .thenReturn(memory);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName("bob"), null, null));

      assertThrows(
          ForbiddenException.class,
          () ->
              new GetEntityTool()
                  .execute(
                      mock(Authorizer.class),
                      securityContext,
                      Map.of("entityType", Entity.CONTEXT_MEMORY, "fqn", fqn)));
    }
  }

  @Test
  void contentReadDeniesAnotherUsersPrivateMemory() {
    String fqn = "alices-private-note";
    ContextMemory memory = privateMemoryOwnedBy("alice", fqn);
    CatalogSecurityContext securityContext = securityContextFor("bob");

    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      entities
          .when(
              () -> Entity.getEntityByName(eq(Entity.CONTEXT_MEMORY), eq(fqn), anyString(), any()))
          .thenReturn(memory);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName("bob"), null, null));

      assertThrows(
          ForbiddenException.class,
          () ->
              new GetEntityTool()
                  .execute(
                      mock(Authorizer.class),
                      securityContext,
                      Map.of(
                          "entityType",
                          Entity.CONTEXT_MEMORY,
                          "fqn",
                          fqn,
                          "include",
                          List.of("content"))));
    }
  }

  /**
   * The read must fetch the relationship fields used by the memory visibility decision. Omitting
   * owners would deny the owner their private memory; omitting primaryEntity would expose an
   * anchored Entity memory as org-wide.
   */
  @Test
  void contentReadFetchesVisibilityFieldsSoTheOwnerKeepsTheirPrivateMemory() throws Exception {
    String fqn = "alices-private-note";
    ContextMemory memory = privateMemoryOwnedBy("alice", fqn);
    CatalogSecurityContext securityContext = securityContextFor("alice");
    Map<String, Object> result;

    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      entities
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.CONTEXT_MEMORY, fqn, "owners,primaryEntity", Include.NON_DELETED))
          .thenReturn(memory);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName("alice"), null, null));

      result =
          new GetEntityTool()
              .execute(
                  mock(Authorizer.class),
                  securityContext,
                  Map.of(
                      "entityType",
                      Entity.CONTEXT_MEMORY,
                      "fqn",
                      fqn,
                      "include",
                      List.of("content")));
    }

    assertThat(castMap(result.get("content")).get("content")).isEqualTo("the secret answer");
  }

  /**
   * A workflow definition's sink credentials sit in a free-form sinkConfig that the generic entity
   * read returns as stored; the MCP read path masks them the way the REST resource does.
   */
  @Test
  void entityDetailsMaskWorkflowSinkSecrets() throws Exception {
    String fqn = "gitExport";
    Map<String, Object> result;

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.WORKFLOW_DEFINITION), eq(fqn), anyString(), any()))
          .thenReturn(gitSinkWorkflow(fqn));
      result =
          new GetEntityTool()
              .execute(
                  mock(Authorizer.class),
                  securityContextFor("alice"),
                  Map.of("entityType", Entity.WORKFLOW_DEFINITION, "fqn", fqn));
    }

    JsonNode sinkConfig = JsonUtils.valueToTree(result).at("/nodes/0/config/sinkConfig");
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/credentials/token").asText());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/signingKey/privateKey").asText());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/signingKey/passphrase").asText());
    assertEquals("https://github.com/org/repo.git", sinkConfig.at("/repositoryUrl").asText());
    assertThat(JsonUtils.pojoToJson(result))
        .doesNotContain(GIT_TOKEN)
        .doesNotContain(SIGNING_KEY)
        .doesNotContain(SIGNING_PASSPHRASE);
  }

  static WorkflowDefinition gitSinkWorkflow(String name) {
    String json =
        """
        {
          "id": "%s",
          "name": "%s",
          "fullyQualifiedName": "%s",
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "sinkTask",
              "name": "gitSink",
              "config": {
                "sinkType": "git",
                "sinkConfig": {
                  "repositoryUrl": "https://github.com/org/repo.git",
                  "credentials": {"type": "token", "token": "%s"},
                  "signingKey": {"privateKey": "%s", "passphrase": "%s"}
                }
              }
            }
          ]
        }
        """
            .formatted(UUID.randomUUID(), name, name, GIT_TOKEN, SIGNING_KEY, SIGNING_PASSPHRASE);
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  @Test
  void contentQuerySearchesTheMemorysPassagesAsTheCaller() throws Exception {
    SubjectContext alice = new SubjectContext(new User().withName("alice"), null, null);

    Map<String, Object> result = readMemoryContentWithQuery(alice, List.of("the matching passage"));

    assertThat(castMap(result.get("content")).get("content")).isEqualTo("the matching passage");
  }

  @Test
  void contentQueryFallsBackToTheFullBodyWhenSearchReturnsNoPassage() throws Exception {
    SubjectContext alice = new SubjectContext(new User().withName("alice"), null, null);

    Map<String, Object> result = readMemoryContentWithQuery(alice, List.of());

    assertThat(castMap(result.get("content")).get("content")).isEqualTo("the secret answer");
  }

  /**
   * The memory read is already authorized, so chunk search must not hide it again: it runs as the
   * caller, and when search still withholds every chunk (an anchored or retired memory, or one not
   * chunked yet) the caller gets the full body instead of nothing.
   */
  private static Map<String, Object> readMemoryContentWithQuery(
      SubjectContext caller, List<String> passages) throws Exception {
    String fqn = "alices-private-note";
    ContextMemory memory = privateMemoryOwnedBy("alice", fqn);
    CatalogSecurityContext securityContext = securityContextFor("alice");
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(vectorService.searchChunksByParent(memory.getId().toString(), "retention", 2, caller))
        .thenReturn(passages);

    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class);
        MockedStatic<OpenSearchVectorService> vectors = mockStatic(OpenSearchVectorService.class)) {
      entities
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.CONTEXT_MEMORY, fqn, "owners,primaryEntity", Include.NON_DELETED))
          .thenReturn(memory);
      entities.when(Entity::getSearchRepository).thenReturn(searchRepository);
      subjects.when(() -> DefaultAuthorizer.getSubjectContext(securityContext)).thenReturn(caller);
      vectors.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      return new GetEntityTool()
          .execute(
              mock(Authorizer.class),
              securityContext,
              Map.of(
                  "entityType",
                  Entity.CONTEXT_MEMORY,
                  "fqn",
                  fqn,
                  "include",
                  List.of("content"),
                  "query",
                  "retention",
                  "passages",
                  2));
    }
  }

  private static ContextMemory privateMemoryOwnedBy(String owner, String fqn) {
    return new ContextMemory()
        .withId(java.util.UUID.randomUUID())
        .withName(fqn)
        .withFullyQualifiedName(fqn)
        .withAnswer("the secret answer")
        .withOwners(
            List.of(
                new EntityReference()
                    .withId(java.util.UUID.randomUUID())
                    .withType(Entity.USER)
                    .withName(owner)
                    .withFullyQualifiedName(owner)))
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
  }

  private static CatalogSecurityContext securityContextFor(String userName) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(userName);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }

  private static Map<String, Object> column(String name, String description) {
    Map<String, Object> column = new HashMap<>();
    column.put("name", name);
    column.put("dataType", "VARCHAR");
    if (description != null) {
      column.put("description", description);
    }
    return column;
  }

  @Test
  void entityDescriptionIsNeverTruncated() {
    Map<String, Object> entity = new HashMap<>();
    String longDescription = "d".repeat(5_000);
    entity.put("description", longDescription);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("description")).isEqualTo(longDescription);
    assertThat(cleaned).doesNotContainKey("columnDescriptionsTruncated");
  }

  @Test
  void longColumnDescriptionsAreReturnedInFull() {
    Map<String, Object> entity = new HashMap<>();
    String longDescription = "x".repeat(5_000);
    entity.put("columns", List.of(column("a", longDescription), column("b", "short")));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned).doesNotContainKey("columnDescriptionsTruncated");
    assertThat(castMap(columnsOf(cleaned).get(0)).get("description")).isEqualTo(longDescription);
  }

  @Test
  void nestedChildColumnDescriptionsAreReturnedInFull() {
    String longDescription = "y".repeat(4_000);
    Map<String, Object> child = column("inner", longDescription);
    Map<String, Object> parent = column("outer", "short");
    parent.put("children", List.of(child));
    Map<String, Object> entity = new HashMap<>();
    entity.put("columns", List.of(parent));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned).doesNotContainKey("columnDescriptionsTruncated");
    assertThat(child.get("description")).isEqualTo(longDescription);
  }

  @Test
  void extensionSurvivesAtTableAndColumnLevel() {
    Map<String, Object> column = column("a", "short");
    column.put("extension", Map.of("colProp", "v"));
    Map<String, Object> entity = new HashMap<>();
    entity.put("extension", Map.of("tableProp", "v"));
    entity.put("columns", List.of(column));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("extension")).isEqualTo(Map.of("tableProp", "v"));
    assertThat(column.get("extension")).isEqualTo(Map.of("colProp", "v"));
  }

  @Test
  void noiseAndVectorFieldsAreRemoved() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("incrementalChangeDescription", Map.of("fieldsAdded", List.of()));
    entity.put("changeDescription", Map.of());
    entity.put("embedding", List.of(0.1, 0.2));
    entity.put("textToEmbed", "blob");
    entity.put("name", "orders");

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned)
        .doesNotContainKeys(
            "incrementalChangeDescription", "changeDescription", "embedding", "textToEmbed")
        .containsKey("name");
  }

  @Test
  void realisticSchemaDefinitionIsReturnedInFull() {
    String ddl = "CREATE TABLE orders (".repeat(700);
    Map<String, Object> entity = new HashMap<>();
    entity.put("schemaDefinition", ddl);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("schemaDefinition")).isEqualTo(ddl);
    assertThat(cleaned).doesNotContainKey("schemaDefinitionTruncated");
  }

  @Test
  void schemaDefinitionBeyondSafetyValveIsCappedWithFlag() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("schemaDefinition", "CREATE TABLE orders (".repeat(1_600));

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat((String) cleaned.get("schemaDefinition")).hasSize(30_003).endsWith("...");
    assertThat(cleaned.get("schemaDefinitionTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void realisticDataModelSqlIsReturnedInFull() {
    Map<String, Object> dataModel = new HashMap<>();
    String sql = "SELECT col FROM upstream JOIN dim USING(k) ".repeat(200);
    dataModel.put("sql", sql);
    Map<String, Object> entity = new HashMap<>();
    entity.put("dataModel", dataModel);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(castMap(cleaned.get("dataModel")).get("sql")).isEqualTo(sql);
    assertThat(castMap(cleaned.get("dataModel"))).doesNotContainKey("sqlTruncated");
  }

  @Test
  void dataModelSqlBeyondSafetyValveIsCappedWithFlag() {
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("sql", "SELECT 1 FROM t ".repeat(2_000));
    dataModel.put("rawSql", "SELECT 2 FROM t ".repeat(2_000));
    Map<String, Object> entity = new HashMap<>();
    entity.put("dataModel", dataModel);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    Map<String, Object> cleanedModel = castMap(cleaned.get("dataModel"));
    assertThat((String) cleanedModel.get("sql")).hasSize(30_003).endsWith("...");
    assertThat((String) cleanedModel.get("rawSql")).hasSize(30_003).endsWith("...");
    assertThat(cleanedModel.get("sqlTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void schemaAndModelSqlShareOneBudgetSoTheirCombinedSizeStaysBounded() {
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("sql", "SELECT 1 FROM t ".repeat(4_000));
    dataModel.put("rawSql", "SELECT 2 FROM t ".repeat(4_000));
    Map<String, Object> entity = new HashMap<>();
    entity.put("schemaDefinition", "CREATE TABLE orders (".repeat(3_000));
    entity.put("dataModel", dataModel);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    String schema = (String) cleaned.get("schemaDefinition");
    Map<String, Object> model = castMap(cleaned.get("dataModel"));
    String sql = (String) model.get("sql");
    String rawSql = (String) model.get("rawSql");
    assertThat(schema).hasSize(30_003);
    assertThat(sql).hasSize(30_003);
    assertThat(rawSql).isEqualTo("...");
    assertThat(schema.length() + sql.length() + rawSql.length()).isLessThanOrEqualTo(61_000);
    assertThat(cleaned.get("schemaDefinitionTruncated")).isEqualTo(Boolean.TRUE);
    assertThat(model.get("sqlTruncated")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void forcedOversizedColumnIsFlaggedWithOffsetAndSkipHint() {
    Map<String, Object> bigColumn = column("big_struct", "x");
    bigColumn.put("blob", "z".repeat((int) (McpResponseTrim.MAX_RESPONSE_CHARS * 0.85)));
    List<Map<String, Object>> columns = new ArrayList<>();
    columns.add(bigColumn);
    columns.add(column("normal", "y"));
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "wide_table");
    entity.put("columns", columns);

    Map<String, Object> firstPage = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(firstPage.get("oversizedColumnOffset")).isEqualTo(0);
    assertThat(firstPage.get("returnedColumns")).isEqualTo(1);
    assertThat(firstPage.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
    assertThat((String) firstPage.get("columnsMessage"))
        .contains("very large")
        .contains("columnOffset=1");
  }

  @Test
  void normalSingleColumnPageIsNotFlaggedOversized() {
    Map<String, Object> entity = wideEntity(5, 10);

    Map<String, Object> page = GetEntityTool.applyColumnWindow(entity, 4, 1);

    assertThat(page.get("returnedColumns")).isEqualTo(1);
    assertThat(page).doesNotContainKey("oversizedColumnOffset");
    assertThat((String) page.get("columnsMessage")).doesNotContain("very large");
  }

  @Test
  void shortSchemaAndModelSqlAreUntouched() {
    Map<String, Object> dataModel = new HashMap<>();
    dataModel.put("sql", "SELECT 1");
    Map<String, Object> entity = new HashMap<>();
    entity.put("schemaDefinition", "CREATE TABLE t (id INT)");
    entity.put("dataModel", dataModel);

    Map<String, Object> cleaned = GetEntityTool.cleanEntityResponse(entity);

    assertThat(cleaned.get("schemaDefinition")).isEqualTo("CREATE TABLE t (id INT)");
    assertThat(cleaned).doesNotContainKey("schemaDefinitionTruncated");
    assertThat(castMap(cleaned.get("dataModel"))).doesNotContainKey("sqlTruncated");
  }

  @Test
  void nullEntityYieldsEmptyResponse() {
    assertThat(GetEntityTool.cleanEntityResponse(null)).isEmpty();
  }

  private static Map<String, Object> wideEntity(int columnCount, int descriptionChars) {
    List<Map<String, Object>> columns = new ArrayList<>();
    for (int i = 0; i < columnCount; i++) {
      columns.add(column("col_" + i, "d".repeat(descriptionChars)));
    }
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "wide_table");
    entity.put("fullyQualifiedName", "svc.db.schema.wide_table");
    entity.put("description", "table level description");
    entity.put("columns", columns);
    return entity;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> columnsOf(Map<String, Object> entity) {
    return (List<Object>) entity.get("columns");
  }

  @Test
  void smallEntityGetsNoWindowMarkers() {
    Map<String, Object> entity = wideEntity(3, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(columnsOf(windowed)).hasSize(3);
    assertThat(windowed)
        .doesNotContainKeys(
            "columnsTruncated",
            "totalColumns",
            "returnedColumns",
            "hasMoreColumns",
            "columnOffset");
  }

  @Test
  void explicitLimitAndOffsetPageColumnsWithMarkers() {
    Map<String, Object> entity = wideEntity(20, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 5, 4);

    List<Object> cols = columnsOf(windowed);
    assertThat(cols).hasSize(4);
    assertThat(castMap(cols.get(0)).get("name")).isEqualTo("col_5");
    assertThat(windowed.get("totalColumns")).isEqualTo(20);
    assertThat(windowed.get("returnedColumns")).isEqualTo(4);
    assertThat(windowed.get("columnOffset")).isEqualTo(5);
    assertThat(windowed.get("columnsTruncated")).isEqualTo(Boolean.TRUE);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void lastPageReportsNoMoreColumns() {
    Map<String, Object> entity = wideEntity(10, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 8, 5);

    assertThat(columnsOf(windowed)).hasSize(2);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.FALSE);
    assertThat(windowed.get("returnedColumns")).isEqualTo(2);
  }

  @Test
  void oversizedColumnsAreAutoCappedUnderBudgetKeepingMetadata() {
    Map<String, Object> entity = wideEntity(2_000, 400);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, -1);

    List<Object> cols = columnsOf(windowed);
    assertThat(cols).isNotEmpty().hasSizeLessThan(2_000);
    assertThat(windowed.get("columnsTruncated")).isEqualTo(Boolean.TRUE);
    assertThat(windowed.get("totalColumns")).isEqualTo(2_000);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
    assertThat(windowed.get("name")).isEqualTo("wide_table");
    assertThat(windowed.get("description")).isEqualTo("table level description");
    assertThat(JsonUtils.pojoToJson(windowed).length())
        .isLessThan(McpResponseTrim.MAX_RESPONSE_CHARS);
  }

  @Test
  void explicitZeroColumnLimitReturnsNoColumnsAndStopsPaging() {
    Map<String, Object> entity = wideEntity(20, 10);

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, 0);

    assertThat(columnsOf(windowed)).isEmpty();
    assertThat(windowed.get("returnedColumns")).isEqualTo(0);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.FALSE);
  }

  @Test
  void entityOverheadExceedingBudgetReturnsNoColumnsAndStopsPaging() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "huge_meta_table");
    entity.put("description", "z".repeat((int) (McpResponseTrim.MAX_RESPONSE_CHARS * 0.85)));
    entity.put("columns", new ArrayList<>(List.of(column("a", "x"), column("b", "y"))));

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(columnsOf(windowed)).isEmpty();
    assertThat(windowed.get("returnedColumns")).isEqualTo(0);
    assertThat(windowed.get("hasMoreColumns")).isEqualTo(Boolean.FALSE);
  }

  @Test
  void singleColumnLargerThanBudgetStillAdvancesPaging() {
    Map<String, Object> bigColumn = column("big_struct", "x");
    bigColumn.put("blob", "z".repeat((int) (McpResponseTrim.MAX_RESPONSE_CHARS * 0.85)));
    List<Map<String, Object>> columns = new ArrayList<>();
    columns.add(bigColumn);
    columns.add(column("normal", "y"));
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "wide_table");
    entity.put("columns", columns);

    Map<String, Object> firstPage = GetEntityTool.applyColumnWindow(entity, 0, -1);

    assertThat(columnsOf(firstPage)).hasSize(1);
    assertThat(castMap(columnsOf(firstPage).get(0)).get("name")).isEqualTo("big_struct");
    assertThat(firstPage.get("returnedColumns")).isEqualTo(1);
    assertThat(firstPage.get("hasMoreColumns")).isEqualTo(Boolean.TRUE);
  }

  @Test
  void nonTableEntityWithoutColumnsPassesThrough() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "my_dashboard");
    entity.put("description", "dash");

    Map<String, Object> windowed = GetEntityTool.applyColumnWindow(entity, 0, 50);

    assertThat(windowed).isEqualTo(entity).doesNotContainKey("columnsTruncated");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Object value) {
    return (Map<String, Object>) value;
  }

  @Test
  void parseReferenceSplitsOnTheFirstColonOnly() {
    // A testCase FQN embeds colons; splitting on all of them would truncate a valid entity.
    GetEntityTool.EntityRef parsed =
        GetEntityTool.parseReference("testCase:svc.db.schema.tbl.col::column_values_between");

    assertEquals("testCase", parsed.entityType());
    assertEquals("svc.db.schema.tbl.col::column_values_between", parsed.fqn());
  }

  @Test
  void parseReferenceTrimsAndAcceptsTheOrdinaryForm() {
    GetEntityTool.EntityRef parsed =
        GetEntityTool.parseReference("  table : sample_data.ecommerce_db.shopify.dim_address ");

    assertEquals("table", parsed.entityType());
    assertEquals("sample_data.ecommerce_db.shopify.dim_address", parsed.fqn());
  }

  @Test
  void parseReferenceRejectsWhatCannotBeAnEntity() {
    assertNull(GetEntityTool.parseReference(null));
    assertNull(GetEntityTool.parseReference("no-colon-at-all"), "a bare FQN has no entity type");
    assertNull(GetEntityTool.parseReference(":svc.db.tbl"), "an empty type is not resolvable");
    assertNull(GetEntityTool.parseReference("table:"), "an empty FQN is not resolvable");
  }
}
