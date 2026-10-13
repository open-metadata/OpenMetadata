package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Integration tests for the {@code overrideMetadata} flag on the bulk path ({@code PUT
 * /v1/tables/bulk?overrideMetadata=true}).
 *
 * <p>A bot PUT must not clobber user-curated {@code description} / {@code displayName} by default,
 * matching the protection the connector-side PATCH path used to provide. {@code
 * overrideMetadata=true} opts out of that protection and also disables the sourceHash fast-path so
 * the override is actually applied.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkOverrideMetadataIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String BLANK_DESCRIPTIONS =
      """
      [{"op":"remove","path":"/description"},
       {"op":"replace","path":"/columns/0/description","value":""}]""";

  @Test
  void test_botCannotOverwriteDescription_withoutOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_desc_off", "curated description", "hash-v1");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_desc_off", "connector description", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), false, botToken);

    assertEquals(
        "curated description",
        getTable(fqn).getDescription(),
        "a bot PUT must not overwrite a non-empty description without overrideMetadata");
  }

  @Test
  void test_botOverwritesDescription_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_desc_on", "curated description", "hash-v1");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_desc_on", "connector description", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "connector description",
        getTable(fqn).getDescription(),
        "overrideMetadata=true lets a bot PUT overwrite the description");
  }

  @Test
  void test_overrideDoesNotBlankDescription(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_desc_blank", "curated description", "hash-v1");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_desc_blank", null, "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "curated description",
        getTable(fqn).getDescription(),
        "overrideMetadata=true must not blank a description when none is supplied");
  }

  @Test
  void test_overrideMetadata_disablesSourceHashFastPath(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_fastpath", "curated description", "stable");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();

    // Same sourceHash but a changed description. With overrideMetadata=true the fast-path is
    // disabled, so the entity is diffed and the override is applied.
    CreateTable changed = table(ns, schemaFqn, "ovr_fastpath", "connector description", "stable");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "connector description",
        getTable(fqn).getDescription(),
        "overrideMetadata=true must disable the sourceHash fast-path");
  }

  @Test
  void test_botCannotOverwriteDisplayName_withoutOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_dn_off", "desc", "hash-v1");
    original.setDisplayName("Curated Display Name");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_dn_off", "desc", "hash-v2");
    changed.setDisplayName("Connector Display Name");
    BulkApi.upsert("tables", List.of(changed), false, botToken);

    assertEquals(
        "Curated Display Name",
        getTable(fqn).getDisplayName(),
        "a bot PUT must not overwrite a non-empty displayName without overrideMetadata");
  }

  @Test
  void test_botOverwritesDisplayName_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_dn_on", "desc", "hash-v1");
    original.setDisplayName("Curated Display Name");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_dn_on", "desc", "hash-v2");
    changed.setDisplayName("Connector Display Name");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "Connector Display Name",
        getTable(fqn).getDisplayName(),
        "overrideMetadata=true lets a bot PUT overwrite the displayName");
  }

  @Test
  void test_overrideDoesNotBlankDisplayName(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_dn_blank", "desc", "hash-v1");
    original.setDisplayName("Curated Display Name");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_dn_blank", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "Curated Display Name",
        getTable(fqn).getDisplayName(),
        "overrideMetadata=true must not blank a displayName when none is supplied");
  }

  @Test
  void test_overrideDoesNotRemoveCertificationWhenNoneSupplied(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_cert_blank", "desc", "hash-v1");
    original.setCertification(goldCertification());
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    assertNotNull(getTable(fqn).getCertification(), "test setup failed to certify the table");

    CreateTable changed = table(ns, schemaFqn, "ovr_cert_blank", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    AssetCertification certification = getTable(fqn).getCertification();
    assertNotNull(
        certification, "overrideMetadata=true must not remove a certification when none is sent");
    assertEquals(CERTIFICATION_GOLD, certification.getTagLabel().getTagFQN());
  }

  @Test
  void test_botCannotOverwriteColumnDescription_withoutOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_off", "desc", "hash-v1");
    setColumnDescription(original, "curated column description");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_col_off", "desc", "hash-v2");
    setColumnDescription(changed, "connector column description");
    BulkApi.upsert("tables", List.of(changed), false, botToken);

    assertEquals(
        "curated column description",
        columnDescription(getTable(fqn)),
        "a bot PUT must not overwrite a non-empty column description without overrideMetadata");
  }

  @Test
  void test_botOverwritesColumnDescription_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_on", "desc", "hash-v1");
    setColumnDescription(original, "curated column description");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_col_on", "desc", "hash-v2");
    setColumnDescription(changed, "connector column description");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "connector column description",
        columnDescription(getTable(fqn)),
        "overrideMetadata=true lets a bot PUT overwrite the column description");
  }

  @Test
  void test_overrideDoesNotBlankColumnDescription(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_blank", "desc", "hash-v1");
    setColumnDescription(original, "curated column description");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    // The connector finds no comment on the column, so it omits the field from the payload.
    CreateTable changed = table(ns, schemaFqn, "ovr_col_blank", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "curated column description",
        columnDescription(getTable(fqn)),
        "overrideMetadata=true must not blank a column description when none is supplied");
  }

  /**
   * Pre-2.0 ingestion clients still PATCH existing tables with the source's empty column comments
   * under overrideMetadata; the PUT guard alone let that blank curated descriptions.
   */
  @Test
  void test_ingestionBotPatchCannotBlankDescriptions(TestNamespace ns) throws Exception {
    Table table = curatedDescriptions(ns, "patch_blank");

    patchAs(table, BLANK_DESCRIPTIONS, BulkApi.botToken());

    Table after = getTable(table.getFullyQualifiedName());
    assertEquals("curated description", after.getDescription());
    assertEquals("curated column", columnDescription(after));
  }

  @Test
  void test_ingestionBotPatchStillReplacesDescriptions(TestNamespace ns) throws Exception {
    Table table = curatedDescriptions(ns, "patch_replace");

    patchAs(
        table,
        """
        [{"op":"replace","path":"/description","value":"from dbt"},
         {"op":"replace","path":"/columns/0/description","value":"column from dbt"}]""",
        BulkApi.botToken());

    Table after = getTable(table.getFullyQualifiedName());
    assertEquals("from dbt", after.getDescription());
    assertEquals("column from dbt", columnDescription(after));
  }

  @Test
  void test_userPatchCanBlankDescriptions(TestNamespace ns) throws Exception {
    Table table = curatedDescriptions(ns, "patch_user_blank");

    patchAs(table, BLANK_DESCRIPTIONS, SdkClients.getAdminToken());

    Table after = getTable(table.getFullyQualifiedName());
    assertTrue(nullOrEmpty(after.getDescription()));
    assertTrue(nullOrEmpty(columnDescription(after)));
  }

  @Test
  void test_columnDisplayNamePreserved_evenWithOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_col_dn", "desc", "hash-v1");
    original.getColumns().getFirst().withDisplayName("Curated Column");
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_col_dn", "desc", "hash-v2");
    changed.getColumns().getFirst().withDisplayName("Connector Column");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    assertEquals(
        "Curated Column",
        getTable(fqn).getColumns().getFirst().getDisplayName(),
        "overrideMetadata governs column descriptions only; a curated column displayName is "
            + "always preserved from a bot PUT");
  }

  @Test
  void test_botReplacesMutuallyExclusiveTableTag_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<TagLabel> tags = createMutuallyExclusiveTags(ns, "ovr_table_tags");
    CreateTable original = table(ns, schemaFqn, "ovr_table_tags", "desc", "hash-v1");
    original.setTags(List.of(tags.getFirst()));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_table_tags", "desc", "hash-v2");
    changed.setTags(List.of(tags.getLast()));
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(List.of(tags.getLast().getTagFQN()), tagFqns(getTable(fqn).getTags()));
  }

  @Test
  void test_botReplacesMutuallyExclusiveColumnTag_withOverride(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<TagLabel> tags = createMutuallyExclusiveTags(ns, "ovr_column_tags");
    CreateTable original = table(ns, schemaFqn, "ovr_column_tags", "desc", "hash-v1");
    original.getColumns().getFirst().setTags(List.of(tags.getFirst()));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_column_tags", "desc", "hash-v2");
    changed.getColumns().getFirst().setTags(List.of(tags.getLast()));
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(
        List.of(tags.getLast().getTagFQN()),
        tagFqns(getTable(fqn).getColumns().getFirst().getTags()));
  }

  @Test
  void test_overrideKeepsTableTagsFromClassificationsNotSent(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<TagLabel> sourceTags = createMutuallyExclusiveTags(ns, "ovr_keep_table_src");
    TagLabel curatedTag = createMutuallyExclusiveTags(ns, "ovr_keep_table_curated").getFirst();
    CreateTable original = table(ns, schemaFqn, "ovr_keep_table", "desc", "hash-v1");
    original.setTags(List.of(sourceTags.getFirst(), curatedTag));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_keep_table", "desc", "hash-v2");
    changed.setTags(List.of(sourceTags.getLast()));
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(
        Set.of(sourceTags.getLast().getTagFQN(), curatedTag.getTagFQN()),
        Set.copyOf(tagFqns(getTable(fqn).getTags())));
  }

  @Test
  void test_overrideKeepsColumnTagsFromClassificationsNotSent(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    List<TagLabel> sourceTags = createMutuallyExclusiveTags(ns, "ovr_keep_col_src");
    TagLabel curatedTag = createMutuallyExclusiveTags(ns, "ovr_keep_col_curated").getFirst();
    CreateTable original = table(ns, schemaFqn, "ovr_keep_col", "desc", "hash-v1");
    original.getColumns().getFirst().setTags(List.of(sourceTags.getFirst(), curatedTag));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_keep_col", "desc", "hash-v2");
    changed.getColumns().getFirst().setTags(List.of(sourceTags.getLast()));
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(
        Set.of(sourceTags.getLast().getTagFQN(), curatedTag.getTagFQN()),
        Set.copyOf(tagFqns(getTable(fqn).getColumns().getFirst().getTags())));
  }

  @Test
  void test_overrideDoesNotRemoveTagsWhenNoneSupplied(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    TagLabel tag = createMutuallyExclusiveTags(ns, "ovr_missing_tags").getFirst();
    CreateTable original = table(ns, schemaFqn, "ovr_missing_tags", "desc", "hash-v1");
    original.setTags(List.of(tag));
    BulkApi.upsert("tables", List.of(original), false, BulkApi.botToken());

    CreateTable changed = table(ns, schemaFqn, "ovr_missing_tags", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, BulkApi.botToken());

    String fqn = schemaFqn + "." + original.getName();
    assertEquals(List.of(tag.getTagFQN()), tagFqns(getTable(fqn).getTags()));
  }

  @Test
  void test_botPutWithoutConstraintsKeepsThem_withoutOverride(TestNamespace ns) throws Exception {
    assertConstraintsSurviveBotPutWithoutThem(ns, "ovr_cons_off", false);
  }

  @Test
  void test_botPutWithoutConstraintsKeepsThem_withOverride(TestNamespace ns) throws Exception {
    assertConstraintsSurviveBotPutWithoutThem(ns, "ovr_cons_on", true);
  }

  @Test
  void test_botPutDropsConstraintOnRemovedColumn(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, "ovr_cons_col", "desc", "hash-v1");
    original.setColumns(
        List.of(
            new Column().withName("c1").withDataType(ColumnDataType.STRING),
            new Column().withName("c2").withDataType(ColumnDataType.STRING)));
    original.setTableConstraints(List.of(primaryKey("c2")));
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, "ovr_cons_col", "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), true, botToken);

    List<TableConstraint> constraints = getTable(fqn).getTableConstraints();
    assertTrue(
        constraints == null || constraints.isEmpty(),
        "a constraint on a column the source dropped must still be removed: " + constraints);
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  private AssetCertification goldCertification() {
    long now = System.currentTimeMillis();
    return new AssetCertification()
        .withTagLabel(
            new TagLabel()
                .withTagFQN(CERTIFICATION_GOLD)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL))
        .withAppliedDate(now)
        .withExpiryDate(now + 30L * 24 * 60 * 60 * 1000);
  }

  private void assertConstraintsSurviveBotPutWithoutThem(
      TestNamespace ns, String baseName, boolean overrideMetadata) throws Exception {
    String schemaFqn = setupSchema(ns);
    String botToken = BulkApi.botToken();
    CreateTable original = table(ns, schemaFqn, baseName, "desc", "hash-v1");
    original.setTableConstraints(List.of(primaryKey("c1")));
    BulkApi.upsert("tables", List.of(original), false, botToken);

    String fqn = schemaFqn + "." + original.getName();
    CreateTable changed = table(ns, schemaFqn, baseName, "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(changed), overrideMetadata, botToken);

    List<TableConstraint> constraints = getTable(fqn).getTableConstraints();
    assertNotNull(constraints, "a bot PUT without constraints must not remove the stored ones");
    assertEquals(1, constraints.size());
    assertEquals(
        TableConstraint.ConstraintType.PRIMARY_KEY, constraints.getFirst().getConstraintType());
    assertEquals(List.of("c1"), constraints.getFirst().getColumns());
  }

  @Test
  void test_botKeepsUserOwners_withoutOverride(TestNamespace ns) throws Exception {
    SharedEntities shared = SharedEntities.get();
    assertEquals(
        List.of(shared.USER1.getId()),
        ownerIdsAfterSourceSendsOwner(ns, "own_keep", shared.USER1_REF, false),
        "owners from the source (ownerConfig/includeOwners) must not replace a user's owners");
  }

  @Test
  void test_botReplacesUserOwners_withOverride(TestNamespace ns) throws Exception {
    SharedEntities shared = SharedEntities.get();
    assertEquals(
        List.of(shared.USER2.getId()),
        ownerIdsAfterSourceSendsOwner(ns, "own_override", shared.USER1_REF, true),
        "overrideMetadata=true lets the source's owners replace the stored ones");
  }

  @Test
  void test_botFillsOwners_whenEntityHasNone(TestNamespace ns) throws Exception {
    SharedEntities shared = SharedEntities.get();
    assertEquals(
        List.of(shared.USER2.getId()),
        ownerIdsAfterSourceSendsOwner(ns, "own_fill", null, false),
        "a source owner still lands on an entity that has none");
  }

  /** A user (admin) creates the table with {@code userOwner}; ingestion re-syncs it as owned by USER2. */
  private List<UUID> ownerIdsAfterSourceSendsOwner(
      TestNamespace ns, String baseName, EntityReference userOwner, boolean overrideMetadata)
      throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable curated = table(ns, schemaFqn, baseName, "desc", "hash-v1");
    if (userOwner != null) {
      curated.setOwners(List.of(userOwner));
    }
    BulkApi.upsert("tables", List.of(curated), false, SdkClients.getAdminToken());

    CreateTable fromSource = table(ns, schemaFqn, baseName, "desc", "hash-v2");
    fromSource.setOwners(List.of(SharedEntities.get().USER2_REF));
    BulkApi.upsert("tables", List.of(fromSource), overrideMetadata, BulkApi.botToken());

    return getTable(schemaFqn + "." + curated.getName()).getOwners().stream()
        .map(EntityReference::getId)
        .toList();
  }

  @Test
  void test_botKeepsTableRetentionPeriod_withoutOverride(TestNamespace ns) throws Exception {
    assertTableRetentionPeriodKept(ns, "ret_off", false);
  }

  @Test
  void test_botKeepsTableRetentionPeriod_withOverride(TestNamespace ns) throws Exception {
    assertTableRetentionPeriodKept(ns, "ret_on", true);
  }

  private void assertTableRetentionPeriodKept(
      TestNamespace ns, String baseName, boolean overrideMetadata) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable curated = table(ns, schemaFqn, baseName, "desc", "hash-v1");
    curated.setRetentionPeriod("P30D");
    BulkApi.upsert("tables", List.of(curated), false, SdkClients.getAdminToken());

    CreateTable fromSource = table(ns, schemaFqn, baseName, "desc", "hash-v2");
    BulkApi.upsert("tables", List.of(fromSource), overrideMetadata, BulkApi.botToken());

    assertEquals(
        "P30D",
        getTable(schemaFqn + "." + curated.getName()).getRetentionPeriod(),
        "no source sends retentionPeriod, so a bot PUT must not blank it");
  }

  @Test
  void test_botKeepsSchemaRetentionPeriod_withOverride(TestNamespace ns) throws Exception {
    String databaseFqn = FullyQualifiedName.getParentFQN(setupSchema(ns));
    CreateDatabaseSchema curated =
        new CreateDatabaseSchema()
            .withName(ns.prefix("ret_schema"))
            .withDatabase(databaseFqn)
            .withRetentionPeriod("P30D");
    curated.setSourceHash("hash-v1");
    BulkApi.upsert("databaseSchemas", List.of(curated), false, SdkClients.getAdminToken());

    CreateDatabaseSchema fromSource =
        new CreateDatabaseSchema().withName(curated.getName()).withDatabase(databaseFqn);
    fromSource.setSourceHash("hash-v2");
    BulkApi.upsert("databaseSchemas", List.of(fromSource), true, BulkApi.botToken());

    DatabaseSchema schema =
        SdkClients.adminClient().databaseSchemas().getByName(databaseFqn + "." + curated.getName());
    assertEquals("P30D", schema.getRetentionPeriod());
  }

  private Table curatedDescriptions(TestNamespace ns, String baseName) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable curated = table(ns, schemaFqn, baseName, "curated description", "hash-v1");
    setColumnDescription(curated, "curated column");
    BulkApi.upsert("tables", List.of(curated), false, SdkClients.getAdminToken());
    return getTable(schemaFqn + "." + curated.getName());
  }

  private void patchAs(Table table, String jsonPatch, String token) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/" + table.getId()))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(jsonPatch))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "patch table: " + response.body());
  }

  private TableConstraint primaryKey(String column) {
    return new TableConstraint()
        .withConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY)
        .withColumns(List.of(column));
  }

  private void setColumnDescription(CreateTable createTable, String description) {
    createTable.getColumns().getFirst().withDescription(description);
  }

  private String columnDescription(Table table) {
    return table.getColumns().getFirst().getDescription();
  }

  private String setupSchema(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return schema.getFullyQualifiedName();
  }

  private List<TagLabel> createMutuallyExclusiveTags(TestNamespace ns, String name) {
    Classification classification =
        SdkClients.adminClient()
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix(name))
                    .withDescription("Mutually exclusive tags for override metadata tests")
                    .withMutuallyExclusive(true));
    Tag original = createTag(classification, "original");
    Tag replacement = createTag(classification, "replacement");
    return List.of(tagLabel(original), tagLabel(replacement));
  }

  private Tag createTag(Classification classification, String name) {
    return SdkClients.adminClient()
        .tags()
        .create(
            new CreateTag()
                .withName(name)
                .withDescription("Tag for override metadata tests")
                .withClassification(classification.getName()));
  }

  private TagLabel tagLabel(Tag tag) {
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.CLASSIFICATION);
  }

  private List<String> tagFqns(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).toList();
  }

  private CreateTable table(
      TestNamespace ns, String schemaFqn, String baseName, String description, String sourceHash) {
    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix(baseName))
            .withDatabaseSchema(schemaFqn)
            .withDescription(description)
            .withColumns(List.of(new Column().withName("c1").withDataType(ColumnDataType.STRING)));
    createTable.setSourceHash(sourceHash);
    return createTable;
  }

  private Table getTable(String fqn) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/tables/name/"
                        + fqn
                        + "?fields=columns,tags,owners,certification,tableConstraints"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "get table " + fqn + ": " + response.body());
    Table table = OBJECT_MAPPER.readValue(response.body(), Table.class);
    assertNotNull(table.getId());
    return table;
  }
}
