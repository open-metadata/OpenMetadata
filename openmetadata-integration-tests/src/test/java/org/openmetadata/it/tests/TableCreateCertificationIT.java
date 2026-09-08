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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Covers {@code CreateTableRequest.certification} (issue #32792) end to end.
 *
 * <p>The create path needs its own coverage because it never constructs an {@code EntityUpdater}:
 * it runs {@code storeRelationshipsInternal -> applyCertification} directly, so it inherits none of
 * the checks in {@code EntityUpdater.updateCertification}. A certification arriving on a create
 * request is therefore the one case where the classification allow-list and the server-computed
 * validity window have to be enforced somewhere else.
 *
 * <p>The bot cases pin the precedence rule: a stored certification beats anything a scheduled
 * re-sync sends, matching the guard on {@code description}/{@code owners}. Ingestion overrides it
 * through the bulk path with {@code overrideMetadata=true}, which is covered as a unit test in
 * {@code EntityRepositoryCertificationTest} because {@code overrideMetadata} is bulk-only.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TableCreateCertificationIT {

  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String CERTIFICATION_BRONZE = "Certification.Bronze";
  private static final String CERTIFICATION_FIELDS = "certification";

  /** Values no server-side computation could produce, so persisting them is unambiguous. */
  private static final long CLIENT_APPLIED_DATE = 1L;

  private static final long CLIENT_EXPIRY_DATE = 32503680000000L; // year 3000

  @Test
  void create_withCertification_appliesItWithServerComputedDates(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    long beforeCreate = System.currentTimeMillis();

    Table table =
        client.tables().create(certifiedRequest(client, ns, "cert_on_create", CERTIFICATION_GOLD));

    Table reloaded = client.tables().get(table.getId().toString(), CERTIFICATION_FIELDS);
    AssetCertification certification = reloaded.getCertification();

    assertNotNull(
        certification, "certification supplied on the create request was silently dropped");
    assertEquals(CERTIFICATION_GOLD, certification.getTagLabel().getTagFQN());
    assertNotEquals(
        CLIENT_EXPIRY_DATE,
        certification.getExpiryDate(),
        "the client's expiryDate was persisted instead of the configured validity period");
    assertTrue(
        certification.getExpiryDate() > certification.getAppliedDate(),
        () ->
            "expiryDate "
                + certification.getExpiryDate()
                + " is not after appliedDate "
                + certification.getAppliedDate());
    assertTrue(
        certification.getAppliedDate() >= beforeCreate,
        () ->
            "appliedDate "
                + certification.getAppliedDate()
                + " predates the request, so it came from the client rather than the server");
  }

  @Test
  void create_withCertificationOutsideAllowedClassification_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String foreignTag = SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN();
    CreateTable request = certifiedRequest(client, ns, "cert_bad_classification", foreignTag);

    assertThrows(
        Exception.class,
        () -> client.tables().create(request),
        "a certification tag outside the configured certification classification was accepted");
  }

  @Test
  void botCreateOrUpdate_omittingCertification_preservesStoredValue(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    CreateTable request = certifiedRequest(admin, ns, "cert_bot_omit", CERTIFICATION_GOLD);
    Table table = admin.tables().create(request);

    SdkClients.ingestionBotClient().tables().createOrUpdate(withoutCertification(request));

    Table reloaded = admin.tables().get(table.getId().toString(), CERTIFICATION_FIELDS);
    assertNotNull(
        reloaded.getCertification(),
        "a bot re-sync that omits certification wiped the stored certification");
    assertEquals(CERTIFICATION_GOLD, reloaded.getCertification().getTagLabel().getTagFQN());
  }

  @Test
  void botCreateOrUpdate_withDifferentCertification_doesNotOverwriteStoredValue(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    CreateTable request = certifiedRequest(admin, ns, "cert_bot_conflict", CERTIFICATION_GOLD);
    Table table = admin.tables().create(request);

    CreateTable resync =
        withoutCertification(request).withCertification(certification(CERTIFICATION_BRONZE));
    SdkClients.ingestionBotClient().tables().createOrUpdate(resync);

    Table reloaded = admin.tables().get(table.getId().toString(), CERTIFICATION_FIELDS);
    assertEquals(
        CERTIFICATION_GOLD,
        reloaded.getCertification().getTagLabel().getTagFQN(),
        "an ingestion bot replaced a stored certification without overrideMetadata");
  }

  @Test
  void botCreateOrUpdate_onUncertifiedTable_appliesCertification(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    CreateTable request = certifiedRequest(admin, ns, "cert_bot_first_run", CERTIFICATION_GOLD);
    Table table = admin.tables().create(withoutCertification(request));
    assertNull(
        admin.tables().get(table.getId().toString(), CERTIFICATION_FIELDS).getCertification(),
        "test setup created an already-certified table");

    SdkClients.ingestionBotClient().tables().createOrUpdate(request);

    Table reloaded = admin.tables().get(table.getId().toString(), CERTIFICATION_FIELDS);
    assertNotNull(
        reloaded.getCertification(),
        "a bot could not set a certification on a table that had none");
    assertEquals(CERTIFICATION_GOLD, reloaded.getCertification().getTagLabel().getTagFQN());
  }

  private static CreateTable certifiedRequest(
      OpenMetadataClient client, TestNamespace ns, String base, String certificationTagFqn) {
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

    return new CreateTable()
        .withName(ns.prefix(base))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
        .withCertification(certification(certificationTagFqn));
  }

  private static CreateTable withoutCertification(CreateTable request) {
    return new CreateTable()
        .withName(request.getName())
        .withDatabaseSchema(request.getDatabaseSchema())
        .withColumns(request.getColumns());
  }

  private static AssetCertification certification(String tagFqn) {
    return new AssetCertification()
        .withTagLabel(
            new TagLabel()
                .withTagFQN(tagFqn)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.AUTOMATED))
        .withAppliedDate(CLIENT_APPLIED_DATE)
        .withExpiryDate(CLIENT_EXPIRY_DATE);
  }
}
