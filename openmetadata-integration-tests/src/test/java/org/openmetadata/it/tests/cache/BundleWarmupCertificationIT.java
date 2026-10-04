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
package org.openmetadata.it.tests.cache;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * End-to-end regression for the {@link
 * org.openmetadata.service.cache.BundleWarmupBatcher} certification leak (issue introduced in
 * 620d1b6ad9). When the bundle warmup app pre-warms the Redis ReadBundle for a certified table:
 *
 * <ul>
 *   <li>G1 — the warmed GET must return a populated {@link AssetCertification} (not null),
 *       because the warmer sets {@code certificationLoaded=false} and lets the read path recompute
 *       it from {@code tag_usage}.
 *   <li>G2 — the warmed {@code tags} array must NOT surface the {@code Certification.*} tag,
 *       because the warmer now strips it out of {@code dto.tags} (mirroring the canonical read
 *       path).
 *   <li>G3 — non-certification tags (e.g. {@code PII.Sensitive}) must be preserved verbatim in
 *       the warmed {@code tags}.
 * </ul>
 *
 * <p>The test triggers the real {@code CacheWarmupApplication} against a live Postgres +
 * Elasticsearch + Redis stack and asserts on the observable API response.
 */
@ExtendWith(TestNamespaceExtension.class)
class BundleWarmupCertificationIT {

  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final String WARMUP_APP = "CacheWarmupApplication";

  @BeforeAll
  static void requireRedisAndNonK8s() {
    assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "Bundle warmup certification IT requires cacheProvider=redis (-Pcache-tests)");
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(),
        "Bundle warmup certification IT requires the non-K8s (Flowable) app trigger backend");
  }

  @Test
  void warmedGetOfCertifiedTableReturnsPopulatedCertAndCertTagStrippedFromTags(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    long ts = System.currentTimeMillis();

    Classification pii =
        client
            .classifications()
            .create(new CreateClassification().withName(ns.prefix("PII")).withDescription("PII"));
    Tag sensitive =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName(ns.prefix("Sensitive"))
                    .withClassification(pii.getName())
                    .withDescription("Sensitive PII tag"));
    TagLabel piiLabel =
        new TagLabel()
            .withTagFQN(sensitive.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix("warmup_cert_db_" + ts))
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("warmup_cert_schema_" + ts))
                    .withDatabase(database.getFullyQualifiedName()));

    long now = System.currentTimeMillis();
    long expiry = now + Duration.ofDays(30).toMillis();
    AssetCertification cert =
        new AssetCertification()
            .withTagLabel(
                new TagLabel()
                    .withTagFQN(CERTIFICATION_GOLD)
                    .withSource(TagLabel.TagSource.CLASSIFICATION)
                    .withLabelType(TagLabel.LabelType.MANUAL))
            .withAppliedDate(now)
            .withExpiryDate(expiry);

    Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("warmup_cert_table_" + ts))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                    .withTags(List.of(piiLabel)));

    table.setCertification(cert);
    table = client.tables().update(table.getId().toString(), table);

    try {
      Table baseline = client.tables().get(table.getId().toString(), "tags,certification");
      assertNotNull(
          baseline.getCertification(), "baseline canonical GET must populate certification");
      assertEquals(
          CERTIFICATION_GOLD,
          baseline.getCertification().getTagLabel().getTagFQN(),
          "baseline certification tag");
      assertTagsStrippedAndPiiPresent(baseline.getTags(), sensitive.getFullyQualifiedName());

      triggerWarmupAndWaitForCompletion(client);

      Table warmed = client.tables().get(table.getId().toString(), "tags,certification");
      assertNotNull(
          warmed.getCertification(),
          "warmed GET must return populated certification (warmer sets certificationLoaded=false)");
      assertEquals(
          CERTIFICATION_GOLD,
          warmed.getCertification().getTagLabel().getTagFQN(),
          "warmed certification tag");
      assertTagsStrippedAndPiiPresent(warmed.getTags(), sensitive.getFullyQualifiedName());
    } finally {
      try {
        client
            .databases()
            .delete(database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
      } catch (Exception ignored) {
        // best-effort cleanup; assertion failures take precedence
      }
    }
  }

  private static void assertTagsStrippedAndPiiPresent(List<TagLabel> tags, String piiFqn) {
    assertNotNull(tags, "tags must be loaded from the bundle");
    boolean hasCertTag =
        tags.stream()
            .anyMatch(t -> t.getTagFQN() != null && t.getTagFQN().startsWith("Certification."));
    assertFalse(hasCertTag, "Certification.* tag must NOT be in the normal tags array: " + tags);
    boolean hasPii = tags.stream().anyMatch(t -> piiFqn.equals(t.getTagFQN()));
    assertTrue(hasPii, "Non-certification tag " + piiFqn + " must be preserved in tags: " + tags);
  }

  private static void triggerWarmupAndWaitForCompletion(OpenMetadataClient client) {
    HttpClient http = client.getHttpClient();
    waitForAppJobCompletion(http);

    Map<String, Object> config = new HashMap<>();
    config.put("entities", List.of("table"));
    config.put("batchSize", 100);
    config.put("warmBundles", true);
    config.put("warmRelationships", false);

    Awaitility.await("Trigger " + WARMUP_APP)
        .atMost(Duration.ofMinutes(3))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              http.execute(HttpMethod.POST, "/v1/apps/trigger/" + WARMUP_APP, config, Void.class);
              return true;
            });

    waitForAppJobCompletion(http);

    await("Warmup run record reflects success for " + WARMUP_APP)
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  http.execute(
                      HttpMethod.GET,
                      "/v1/apps/name/" + WARMUP_APP + "/runs/latest",
                      null,
                      AppRunRecord.class);
              assertNotNull(run);
              String status = run.getStatus() == null ? null : run.getStatus().value();
              assertNotNull(status, "warmup run status must be present");
              assertFalse(
                  "running".equalsIgnoreCase(status) || "started".equalsIgnoreCase(status),
                  "warmup run still in-flight: " + status);
            });
  }

  private static void waitForAppJobCompletion(HttpClient http) {
    try {
      await("Wait for app job completion: " + WARMUP_APP)
          .atMost(Duration.ofMinutes(5))
          .pollDelay(Duration.ofMillis(500))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .until(
              () -> {
                AppRunRecord latestRun =
                    http.execute(
                        HttpMethod.GET,
                        "/v1/apps/name/" + WARMUP_APP + "/runs/latest",
                        null,
                        AppRunRecord.class);
                if (latestRun == null || latestRun.getStatus() == null) {
                  return true;
                }
                String status = latestRun.getStatus().value();
                return !"running".equalsIgnoreCase(status) && !"started".equalsIgnoreCase(status);
              });
    } catch (org.awaitility.core.ConditionTimeoutException ignored) {
      // best-effort wait — the trigger call handles "already running" with its own retry
    }
  }
}
