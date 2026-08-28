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

/**
 * Regression for issue #30545: {@code PUT /v1/tables/{id}/dataModel} (the endpoint every dbt
 * ingestion calls once per manifest node) wipes the table's certification.
 *
 * <p>{@code TableRepository.addDataModel} deletes every {@code tag_usage} row for the table with the
 * prefix-agnostic {@code deleteTagsByTarget} and then re-applies only {@code table.getTags()}, which
 * deliberately excludes certification-classification tags because certification is surfaced as its
 * own entity field. The certification row is deleted but never re-applied.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TableDataModelCertificationIT {

  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String CERTIFICATION_PREFIX = "Certification.";
  private static final String CERTIFICATION_FIELDS = "certification,tags";

  @Test
  void addDataModel_withoutTags_preservesCertification(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String existingTagFqn = SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN();
    Table table = createCertifiedTable(client, ns, "dm_cert_no_tags", existingTagFqn);

    client
        .tables()
        .updateDataModel(
            table.getId().toString(),
            new DataModel().withModelType(DataModel.ModelType.DBT).withTags(List.of()));

    Table reloaded = client.tables().get(table.getId().toString(), CERTIFICATION_FIELDS);
    assertNotNull(
        reloaded.getCertification(),
        "addDataModel with an empty tag list removed the table certification");
    assertEquals(
        CERTIFICATION_GOLD,
        reloaded.getCertification().getTagLabel().getTagFQN(),
        "certification changed");
    assertTrue(
        reloaded.getTags().stream().anyMatch(t -> existingTagFqn.equals(t.getTagFQN())),
        () -> "pre-existing classification tag was dropped; tags=" + reloaded.getTags());
  }

  @Test
  void addDataModel_withTags_preservesCertification(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String existingTagFqn = SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN();
    String dbtTagFqn = SharedEntities.get().PERSONAL_DATA_TAG_LABEL.getTagFQN();
    Table table = createCertifiedTable(client, ns, "dm_cert_with_tags", existingTagFqn);

    client
        .tables()
        .updateDataModel(
            table.getId().toString(),
            new DataModel()
                .withModelType(DataModel.ModelType.DBT)
                .withTags(List.of(classificationTag(dbtTagFqn))));

    Table reloaded = client.tables().get(table.getId().toString(), CERTIFICATION_FIELDS);
    assertNotNull(
        reloaded.getCertification(), "addDataModel with dbt tags removed the table certification");
    assertEquals(
        CERTIFICATION_GOLD,
        reloaded.getCertification().getTagLabel().getTagFQN(),
        "certification changed");
    assertTrue(
        reloaded.getTags().stream().anyMatch(t -> dbtTagFqn.equals(t.getTagFQN())),
        () -> "dbt tag was not applied; tags=" + reloaded.getTags());
    assertTrue(
        reloaded.getTags().stream().noneMatch(t -> t.getTagFQN().startsWith(CERTIFICATION_PREFIX)),
        () -> "certification leaked into the tags array; tags=" + reloaded.getTags());
  }

  private static Table createCertifiedTable(
      OpenMetadataClient client, TestNamespace ns, String base, String existingTagFqn) {
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix(base + "_db"))
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix(base + "_schema"))
                    .withDatabase(database.getFullyQualifiedName()));
    Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix(base))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                    .withTags(List.of(classificationTag(existingTagFqn))));

    long now = System.currentTimeMillis();
    table.setCertification(
        new AssetCertification()
            .withTagLabel(classificationTag(CERTIFICATION_GOLD))
            .withAppliedDate(now)
            .withExpiryDate(now + Duration.ofDays(30).toMillis()));
    Table certified = client.tables().update(table.getId().toString(), table);
    assertNotNull(certified.getCertification(), "test setup failed to certify the table");
    return certified;
  }

  private static TagLabel classificationTag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }
}
