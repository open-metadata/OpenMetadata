/*
 *  Copyright 2026 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * A certification tag applied through {@code tags} (on create, or by dbt through {@code PUT
 * /tables/{id}/dataModel}) is stored without an expiry, and typed clients reject an entity whose
 * certification lacks one. Every read must serve both dates.
 *
 * <p>The Java POJO does not enforce the schema's {@code required}, so these explicit date checks
 * stand in for the pydantic failure. The parallel lane runs on the default P30D validity period.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class CertificationWithoutExpiryIT {

  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String CERTIFICATION_SILVER = "Certification.Silver";
  private static final long DEFAULT_VALIDITY_MILLIS = Duration.ofDays(30).toMillis();

  @Test
  void get_certificationTagOnCreate_hasExpiry(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, createSchema(client, ns, "get_tag_on_create"), true);

    Table reloaded = client.tables().get(table.getId().toString(), "certification");

    assertDerivedFromAppliedDate(reloaded.getCertification(), CERTIFICATION_GOLD);
  }

  @Test
  void list_withCertificationField_hasExpiry(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseSchema schema = createSchema(client, ns, "list_cert_field");
    Table table = createTable(client, schema, true);

    Table listed = listed(client, schema, table, "certification");

    assertDerivedFromAppliedDate(listed.getCertification(), CERTIFICATION_GOLD);
  }

  @Test
  void addDataModel_withCertificationTag_responseHasExpiry(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, createSchema(client, ns, "dbt_response"), false);

    Table response = addDbtModelWithGold(client, table);

    assertDerivedFromAppliedDate(response.getCertification(), CERTIFICATION_GOLD);
  }

  @Test
  void patchUnrelatedField_returnsStableExpiry(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, createSchema(client, ns, "patch_unrelated"), true);
    Table beforePatch = client.tables().get(table.getId().toString(), "certification,tags");
    assertDerivedFromAppliedDate(beforePatch.getCertification(), CERTIFICATION_GOLD);
    long expiryBeforePatch = beforePatch.getCertification().getExpiryDate();

    beforePatch.setDescription("changed by " + ns.prefix("patch"));
    Table patched = client.tables().update(table.getId().toString(), beforePatch);

    assertDerivedFromAppliedDate(patched.getCertification(), CERTIFICATION_GOLD);
    assertEquals(expiryBeforePatch, patched.getCertification().getExpiryDate());
  }

  @Test
  void listWithTagsOnly_servesCurrentCertification(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseSchema schema = createSchema(client, ns, "list_tags_only");
    Table table = createTable(client, schema, false);
    // dbt runs twice, as it does on every scheduled run: the first call applies the Gold tag, the
    // second loads the now-certified table and rewrites its row, which used to store Gold inline.
    addDbtModelWithGold(client, table);
    addDbtModelWithGold(client, table);

    assertDerivedFromAppliedDate(
        listed(client, schema, table, "tags").getCertification(), CERTIFICATION_GOLD);

    Table current = client.tables().get(table.getId().toString(), "certification,tags");
    long beforePatch = System.currentTimeMillis();
    current.setCertification(
        new AssetCertification()
            .withTagLabel(classificationTag(CERTIFICATION_SILVER))
            .withAppliedDate(1L)
            .withExpiryDate(2L));
    client.tables().update(table.getId().toString(), current);
    // The PATCH stores the row without certification, so put back the dateless Gold copy a server
    // without this fix left there: an upgraded catalog still holds such rows.
    plantInlineCertification(table, CERTIFICATION_GOLD);

    // A stamped row reads appliedDate from tag_usage.appliedAt, a few ms off the stamping clock, so
    // only the expiry the PATCH stamped is checked exactly.
    AssetCertification silver = listed(client, schema, table, "tags").getCertification();
    assertNotNull(silver, "certification is missing");
    assertEquals(CERTIFICATION_SILVER, silver.getTagLabel().getTagFQN());
    assertNotNull(silver.getAppliedDate(), () -> "no appliedDate: " + silver);
    assertTrue(
        silver.getExpiryDate() >= beforePatch + DEFAULT_VALIDITY_MILLIS,
        () -> "the list did not serve the expiry the PATCH stamped: " + silver);
    assertNull(
        listed(client, schema, table, "owners").getCertification(),
        "a list that requests neither tags nor certification served the copy in the row");
  }

  private static void plantInlineCertification(Table table, String tagFqn) {
    EntityDAO<Table> rows = Entity.getCollectionDAO().tableDAO();
    Table row = rows.findEntityById(table.getId());
    row.setCertification(new AssetCertification().withTagLabel(classificationTag(tagFqn)));
    rows.update(row);
    EntityRepository.invalidateCacheForEntity(
        Entity.TABLE, table.getId(), table.getFullyQualifiedName());
  }

  private static void assertDerivedFromAppliedDate(
      AssetCertification certification, String expectedTagFqn) {
    assertNotNull(certification, "certification is missing");
    assertEquals(expectedTagFqn, certification.getTagLabel().getTagFQN());
    assertNotNull(certification.getAppliedDate(), () -> "no appliedDate: " + certification);
    assertNotNull(certification.getExpiryDate(), () -> "no expiryDate: " + certification);
    assertEquals(
        certification.getAppliedDate() + DEFAULT_VALIDITY_MILLIS,
        certification.getExpiryDate(),
        () -> "expiryDate is not appliedDate + P30D: " + certification);
  }

  private static Table addDbtModelWithGold(OpenMetadataClient client, Table table) {
    return client
        .tables()
        .updateDataModel(
            table.getId().toString(),
            new DataModel()
                .withModelType(DataModel.ModelType.DBT)
                .withTags(List.of(classificationTag(CERTIFICATION_GOLD))));
  }

  private static Table listed(
      OpenMetadataClient client, DatabaseSchema schema, Table table, String fields) {
    List<Table> page =
        client
            .tables()
            .list(
                new ListParams()
                    .setDatabaseSchema(schema.getFullyQualifiedName())
                    .setFields(fields))
            .getData();
    return page.stream()
        .filter(listedTable -> table.getId().equals(listedTable.getId()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("table missing from its schema's list: " + page));
  }

  private static DatabaseSchema createSchema(
      OpenMetadataClient client, TestNamespace ns, String base) {
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix(base + "_db"))
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    return client
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(ns.prefix(base + "_schema"))
                .withDatabase(database.getFullyQualifiedName()));
  }

  private static Table createTable(
      OpenMetadataClient client, DatabaseSchema schema, boolean certificationInTags) {
    CreateTable request =
        new CreateTable()
            .withName(schema.getName() + "_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    if (certificationInTags) {
      request.withTags(List.of(classificationTag(CERTIFICATION_GOLD)));
    }
    return client.tables().create(request);
  }

  private static TagLabel classificationTag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }
}
