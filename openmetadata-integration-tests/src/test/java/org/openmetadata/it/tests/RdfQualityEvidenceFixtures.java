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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Quality evidence written through the public API: an {@code orders} table whose {@code email}
 * column is PII.Sensitive, its profile, a column test and its results.
 */
final class RdfQualityEvidenceFixtures {

  private RdfQualityEvidenceFixtures() {}

  static Table table(final TestNamespace namespace) {
    final String tag = namespace.uniqueShortId();
    final DatabaseService service =
        namespace.trackRoot(
            Entity.DATABASE_SERVICE,
            DatabaseServices.builder()
                .name("qsvc_" + tag)
                .connection(
                    DatabaseServices.postgresConnection()
                        .hostPort("localhost:5432")
                        .username("test")
                        .build())
                .create());
    final Database database =
        Databases.create().name("qdb_" + tag).in(service.getFullyQualifiedName()).execute();
    final DatabaseSchema schema =
        DatabaseSchemas.create().name("qsch_" + tag).in(database.getFullyQualifiedName()).execute();
    return Tables.create()
        .name("orders_" + tag)
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(
            List.of(
                new Column().withName("amount").withDataType(ColumnDataType.DOUBLE),
                new Column().withName("status").withDataType(ColumnDataType.STRING),
                new Column()
                    .withName("email")
                    .withDataType(ColumnDataType.STRING)
                    .withTags(List.of(sensitive()))))
        .execute();
  }

  static void putProfile(
      final OpenMetadataClient client,
      final Table table,
      final long timestamp,
      final double rowCount,
      final double nullCount) {
    final CreateTableProfile profile =
        new CreateTableProfile()
            .withTableProfile(
                new TableProfile()
                    .withTimestamp(timestamp)
                    .withRowCount(rowCount)
                    .withColumnCount(3.0))
            .withColumnProfile(
                List.of(
                    new ColumnProfile()
                        .withName("amount")
                        .withTimestamp(timestamp)
                        .withNullCount(nullCount)
                        .withMin(-3.0)
                        .withMax(99.0),
                    new ColumnProfile()
                        .withName("email")
                        .withTimestamp(timestamp)
                        .withNullCount(0.0)
                        .withMinLength(5.0)));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/tables/" + table.getId() + "/tableProfile", profile, Table.class);
  }

  static void postResult(
      final OpenMetadataClient client,
      final TestCase testCase,
      final long timestamp,
      final TestCaseStatus status,
      final long failed) {
    client
        .testCaseResults()
        .create(
            testCase.getFullyQualifiedName(),
            new CreateTestCaseResult()
                .withTimestamp(timestamp)
                .withTestCaseStatus(status)
                .withResult(status.value())
                .withPassedRows(10L - failed)
                .withFailedRows(failed));
  }

  static void enableAutoCloseIncident(final OpenMetadataClient client, final TestCase testCase) {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/dataQuality/testCases/" + testCase.getId(),
            "[{\"op\":\"add\",\"path\":\"/autoCloseIncident\",\"value\":true}]",
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  static void tagSensitive(final OpenMetadataClient client, final Table table, final String name) {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/columns/name/"
                + URLEncoder.encode(
                    table.getFullyQualifiedName() + "." + name, StandardCharsets.UTF_8)
                + "?entityType=table",
            new UpdateColumn().withTags(List.of(sensitive())));
  }

  private static TagLabel sensitive() {
    return new TagLabel()
        .withTagFQN("PII.Sensitive")
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }
}
