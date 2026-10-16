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
package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class QueryBodyTextContributorTest {

  private static Query query() {
    return new Query()
        .withId(UUID.randomUUID())
        .withName("9f1c0c0d5b2e4a6f8c3d1e7b9a5f2c40")
        .withDisplayName("Monthly revenue by region")
        .withDescription("Total completed order revenue per region for the last full month.")
        .withQuery("SELECT region, SUM(amount) FROM sales.orders GROUP BY region")
        .withQueryUsedIn(
            List.of(
                new EntityReference()
                    .withName("orders")
                    .withFullyQualifiedName("snowflake.sales.public.orders")
                    .withType(Entity.TABLE)));
  }

  @Test
  void bodyTextCarriesIntentSqlAndLinkedTables() {
    String body = QueryBodyTextContributor.extractBodyText(query());

    assertTrue(body.contains("Monthly revenue by region"), "displayName should be present");
    assertTrue(body.contains("last full month"), "description should be present");
    assertTrue(body.contains("SUM(amount)"), "SQL should be present");
    assertTrue(
        body.contains("snowflake.sales.public.orders"), "linked table FQN should be present");
  }

  @Test
  void intentTextLeadsTheSqlSoItSurvivesChunking() {
    String body = QueryBodyTextContributor.extractBodyText(query());

    assertTrue(
        body.indexOf("Monthly revenue by region") < body.indexOf("SUM(amount)"),
        "displayName must precede the SQL: chunking would otherwise strand the intent text");
  }

  @Test
  void longSqlIsCapped() {
    String longSql = "SELECT " + "a, ".repeat(4000) + "b FROM t";
    String body =
        QueryBodyTextContributor.extractBodyText(query().withQuery(longSql).withQueryUsedIn(null));

    assertTrue(body.endsWith("..."), "capped SQL should be marked as truncated");
    assertTrue(
        body.length() < longSql.length(), "capped body must be shorter than the raw statement");
    assertTrue(
        body.contains("sql: SELECT a, "), "the head of the statement should survive the cap");
  }

  @Test
  void absentUsedInIsOmittedRatherThanRenderedEmpty() {
    // queryUsedIn is stripped from stored JSON, so null must not be reported as "no tables".
    String body = QueryBodyTextContributor.extractBodyText(query().withQueryUsedIn(null));

    assertFalse(body.contains("usedIn"), "absent queryUsedIn should contribute nothing");
  }

  @Test
  void ingestedQueryWithNoIntentTextStillEmbedsItsSql() {
    // The ingestion path leaves name = MD5(sql) and no description; the SQL is all there is.
    Query ingested =
        new Query()
            .withId(UUID.randomUUID())
            .withName("9f1c0c0d5b2e4a6f8c3d1e7b9a5f2c40")
            .withQuery("SELECT * FROM sales.orders");

    assertEquals(
        "sql: SELECT * FROM sales.orders", QueryBodyTextContributor.extractBodyText(ingested));
  }

  @Test
  void extractorReturnsNullForWrongEntityType() {
    // Wrong-type input must fall back to the default extractor (null signals fallback).
    assertNull(QueryBodyTextContributor.extractBodyText(new TestSuite()));
  }
}
