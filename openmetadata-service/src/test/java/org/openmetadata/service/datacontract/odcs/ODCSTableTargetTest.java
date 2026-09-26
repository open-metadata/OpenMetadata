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

package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.util.FullyQualifiedName;

class ODCSTableTargetTest {

  @Test
  void sqlNameLeavesOutTheService() {
    assertEquals(
        "SALES.PUBLIC.orders",
        target("Snowflake", "snowflake", "SALES", "PUBLIC", "orders").sqlName());
  }

  @Test
  void sqlNameLeavesOutThePlaceholderDatabaseOfServicesWithoutOne() {
    assertEquals("shop.orders", target("Mysql", "mysql", "default", "shop", "orders").sqlName());
  }

  @Test
  void sqlNameQuotesNamesTheServiceCannotReadBare() {
    assertEquals(
        "`my-project`.sales.orders",
        target("BigQuery", "bq", "my-project", "sales", "orders").sqlName());
    assertEquals(
        "sales.dbo.[order lines]",
        target("Mssql", "mssql", "sales", "dbo", "order lines").sqlName());
    assertEquals(
        "analytics.public.\"Orders\"",
        target("Postgres", "pg", "analytics", "public", "Orders").sqlName());
  }

  @Test
  void sqlNameEscapesTheQuoteInsideAName() {
    assertEquals(
        "db.\"sch\"\"x\".\"order.lines\"",
        target("Postgres", "pg", "db", "sch\"x", "order.lines").sqlName());
  }

  /**
   * The quote style follows the service type's JSON value: the generated enum constant named {@code
   * AzureSQL} carries the value {@code Databricks}, so matching by constant would pick brackets.
   */
  @Test
  void quoteStyleFollowsTheServiceTypeValue() {
    assertEquals(
        "hive_metastore.`my-schema`.orders",
        target("Databricks", "dbx", "hive_metastore", "my-schema", "orders").sqlName());
  }

  @Test
  void tableWithoutAServiceTypeUsesStandardSqlQuotes() {
    ODCSTableTarget target =
        ODCSTableTarget.of(
            new Table()
                .withFullyQualifiedName(FullyQualifiedName.build("svc", "db", "sch", "My Table"))
                .withColumns(List.of()));

    assertEquals("db.sch.\"My Table\"", target.sqlName());
  }

  @ParameterizedTest
  @CsvSource({
    "Account Region, \"Account Region\"",
    "updated_at, updated_at",
    "UPDATED_AT, UPDATED_AT",
    "updatedAt, \"updatedAt\"",
    "2024_total, \"2024_total\""
  })
  void sqlColumnNameQuotesOnlyWhatNeedsIt(String column, String expected) {
    assertEquals(expected, target("Postgres", "pg", "db", "sch", "orders").sqlColumnName(column));
  }

  private static ODCSTableTarget target(String serviceType, String... fqnParts) {
    return ODCSTableTarget.of(
        new Table()
            .withFullyQualifiedName(FullyQualifiedName.build(fqnParts))
            .withServiceType(DatabaseServiceType.fromValue(serviceType))
            .withColumns(List.of()));
  }
}
