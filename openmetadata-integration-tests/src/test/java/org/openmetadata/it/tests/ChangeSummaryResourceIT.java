package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.feed.CreateSuggestion;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for the changeSummary API, focusing on correct tracking of who changed each
 * field when multiple users accept suggestions sequentially.
 *
 * <p>Key bug scenario: when two suggestions propose the same description text (common with
 * AI-generated suggestions), the second acceptance produces no JSON patch diff, so the
 * changeSummary never updates to reflect the second user. The "same value" tests below reproduce
 * this exact issue.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ChangeSummaryResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private static final String SHARED_DESCRIPTION =
      "AI-suggested description for analytics and reporting";

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  /**
   * Reproduces the core bug: two suggestions with the SAME description text accepted by different
   * users. The second acceptance sets an identical value, producing an empty JSON patch, so the
   * changeSummary still shows the first user.
   */
  @Test
  void testChangeSummaryUpdatesWhenSameValueAcceptedByDifferentUser(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    OpenMetadataClient user1Client = SdkClients.user1Client();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // User1 accepts a description suggestion
    Suggestion suggestion1 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription(SHARED_DESCRIPTION)
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(entityLink));
    acceptSuggestion(user1Client, suggestion1.getId().toString());

    // Verify changeSummary reflects user1
    Map<String, Object> summary1 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries1 = extractChangeSummary(summary1);
    assertNotNull(entries1.get("description"));

    String firstChangedBy = (String) entries1.get("description").get("changedBy");
    long firstChangedAt = ((Number) entries1.get("description").get("changedAt")).longValue();
    assertTrue(
        firstChangedBy.contains("shared_user1"),
        "Expected changedBy to contain shared_user1 but was: " + firstChangedBy);

    // Admin accepts a second suggestion with the SAME description value
    Suggestion suggestion2 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription(SHARED_DESCRIPTION)
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(entityLink));
    acceptSuggestion(adminClient, suggestion2.getId().toString());

    // The description value is the same, but a different user accepted it.
    // changeSummary must reflect the latest acceptor.
    Map<String, Object> summary2 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries2 = extractChangeSummary(summary2);
    assertNotNull(entries2.get("description"));

    String secondChangedBy = (String) entries2.get("description").get("changedBy");
    long secondChangedAt = ((Number) entries2.get("description").get("changedAt")).longValue();

    assertTrue(
        secondChangedBy.contains("admin"),
        "Expected changedBy to contain admin after second acceptance but was: " + secondChangedBy);
    assertTrue(
        secondChangedAt >= firstChangedAt,
        "Expected second changedAt (%d) >= first changedAt (%d)"
            .formatted(secondChangedAt, firstChangedAt));
  }

  /** Same bug at the column level: same column description accepted by two different users. */
  @Test
  void testChangeSummaryUpdatesColumnWhenSameValueAcceptedByDifferentUser(TestNamespace ns)
      throws Exception {
    Table table = createTestTableWithColumns(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::name>", table.getFullyQualifiedName());

    OpenMetadataClient user1Client = SdkClients.user1Client();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // User1 accepts a column description suggestion
    Suggestion suggestion1 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription(SHARED_DESCRIPTION)
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(columnLink));
    acceptSuggestion(user1Client, suggestion1.getId().toString());

    Map<String, Object> summary1 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries1 = extractChangeSummary(summary1);
    Map<String, Object> colEntry1 = findEntryByPrefix(entries1, "columns.name.description");
    assertNotNull(colEntry1);

    String firstChangedBy = (String) colEntry1.get("changedBy");
    long firstChangedAt = ((Number) colEntry1.get("changedAt")).longValue();
    assertTrue(
        firstChangedBy.contains("shared_user1"),
        "Expected changedBy to contain shared_user1 but was: " + firstChangedBy);

    // Admin accepts a second suggestion with the SAME description
    Suggestion suggestion2 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription(SHARED_DESCRIPTION)
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(columnLink));
    acceptSuggestion(adminClient, suggestion2.getId().toString());

    // changeSummary must reflect admin, not user1
    Map<String, Object> summary2 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries2 = extractChangeSummary(summary2);
    Map<String, Object> colEntry2 = findEntryByPrefix(entries2, "columns.name.description");
    assertNotNull(colEntry2);

    String secondChangedBy = (String) colEntry2.get("changedBy");
    long secondChangedAt = ((Number) colEntry2.get("changedAt")).longValue();
    assertTrue(
        secondChangedBy.contains("admin"),
        "Expected changedBy to contain admin after second acceptance but was: " + secondChangedBy);
    assertTrue(
        secondChangedAt >= firstChangedAt,
        "Expected second changedAt (%d) >= first changedAt (%d)"
            .formatted(secondChangedAt, firstChangedAt));
  }

  /**
   * Sanity check: when two suggestions have DIFFERENT values, the changeSummary updates correctly.
   * This already works today; the bug only manifests when the value is the same.
   */
  @Test
  void testChangeSummaryUpdatesWhenDifferentValuesAcceptedByDifferentUsers(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns);
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    OpenMetadataClient user1Client = SdkClients.user1Client();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // User1 accepts a description suggestion
    Suggestion suggestion1 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription("Description from first suggestion")
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(entityLink));
    acceptSuggestion(user1Client, suggestion1.getId().toString());

    Map<String, Object> summary1 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries1 = extractChangeSummary(summary1);
    assertNotNull(entries1.get("description"));

    String firstChangedBy = (String) entries1.get("description").get("changedBy");
    long firstChangedAt = ((Number) entries1.get("description").get("changedAt")).longValue();
    assertTrue(
        firstChangedBy.contains("shared_user1"),
        "Expected changedBy to contain shared_user1 but was: " + firstChangedBy);

    // Admin accepts a second suggestion with a DIFFERENT description
    Suggestion suggestion2 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription("Description from second suggestion")
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(entityLink));
    acceptSuggestion(adminClient, suggestion2.getId().toString());

    Table updatedTable = Tables.findByName(table.getFullyQualifiedName()).fetch().get();
    assertEquals("Description from second suggestion", updatedTable.getDescription());

    Map<String, Object> summary2 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries2 = extractChangeSummary(summary2);
    assertNotNull(entries2.get("description"));

    String secondChangedBy = (String) entries2.get("description").get("changedBy");
    long secondChangedAt = ((Number) entries2.get("description").get("changedAt")).longValue();

    assertTrue(
        secondChangedBy.contains("admin"),
        "Expected changedBy to contain admin but was: " + secondChangedBy);
    assertTrue(
        secondChangedAt >= firstChangedAt,
        "Expected second changedAt (%d) >= first changedAt (%d)"
            .formatted(secondChangedAt, firstChangedAt));
  }

  /** Verifies independent columns are tracked correctly with different users. */
  @Test
  void testChangeSummaryTracksMultipleColumnsIndependently(TestNamespace ns) throws Exception {
    Table table = createTestTableWithColumns(ns);
    String col1Link =
        String.format("<#E::table::%s::columns::name>", table.getFullyQualifiedName());
    String col2Link =
        String.format("<#E::table::%s::columns::email>", table.getFullyQualifiedName());

    OpenMetadataClient user1Client = SdkClients.user1Client();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // User1 accepts a suggestion on column "name"
    Suggestion suggestion1 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription("Name column description by user1")
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(col1Link));
    acceptSuggestion(user1Client, suggestion1.getId().toString());

    // Admin accepts a suggestion on column "email"
    Suggestion suggestion2 =
        createSuggestion(
            new CreateSuggestion()
                .withDescription("Email column description by admin")
                .withType(SuggestionType.SuggestDescription)
                .withEntityLink(col2Link));
    acceptSuggestion(adminClient, suggestion2.getId().toString());

    Map<String, Object> summary = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries = extractChangeSummary(summary);

    Map<String, Object> nameEntry = findEntryByPrefix(entries, "columns.name.description");
    Map<String, Object> emailEntry = findEntryByPrefix(entries, "columns.email.description");

    assertNotNull(nameEntry, "Expected changeSummary entry for columns.name.description");
    assertNotNull(emailEntry, "Expected changeSummary entry for columns.email.description");

    String nameChangedBy = (String) nameEntry.get("changedBy");
    String emailChangedBy = (String) emailEntry.get("changedBy");

    assertTrue(
        nameChangedBy.contains("shared_user1"),
        "Expected name column changedBy to contain shared_user1 but was: " + nameChangedBy);
    assertTrue(
        emailChangedBy.contains("admin"),
        "Expected email column changedBy to contain admin but was: " + emailChangedBy);
  }

  // --- Helper methods ---

  private Table createTestTable(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);
    return TableTestFactory.createSimpleWithName(
        "tbl" + shortId, ns, schema.getFullyQualifiedName());
  }

  private Table createTestTableWithColumns(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build());

    return Tables.create()
        .name("tbl" + shortId)
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(columns)
        .execute();
  }

  private Suggestion createSuggestion(CreateSuggestion createSuggestion) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                "/v1/suggestions",
                createSuggestion,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, Suggestion.class);
  }

  private void acceptSuggestion(OpenMetadataClient client, String suggestionId) throws Exception {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/suggestions/" + suggestionId + "/accept",
            null,
            RequestOptions.builder().build());
  }

  private Map<String, Object> getChangeSummary(String entityType, String fqn) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/changeSummary/" + entityType + "/name/" + fqn,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, new TypeReference<Map<String, Object>>() {});
  }

  @SuppressWarnings("unchecked")
  private Map<String, Map<String, Object>> extractChangeSummary(Map<String, Object> response) {
    return (Map<String, Map<String, Object>>) response.get("changeSummary");
  }

  private Map<String, Object> findEntryByPrefix(
      Map<String, Map<String, Object>> entries, String prefix) {
    return entries.entrySet().stream()
        .filter(e -> e.getKey().startsWith(prefix) || e.getKey().equals(prefix))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }
}
