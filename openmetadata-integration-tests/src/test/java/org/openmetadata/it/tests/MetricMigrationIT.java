/*
 *  Copyright 2021 Collate
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.MergedMetricMigrationTestSupport.runMergedUpgradeScenario;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.readMigrationScripts;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.INCIDENT_INDEXES;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.INCIDENT_TABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MEMBERSHIP_COLUMN;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MEMBERSHIP_INDEX;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_GROUP_DELETED_INDEX;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_GROUP_NAME_INDEX;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_GROUP_TABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_TABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MYSQL_MEMBERSHIP_COLUMN_DDL_VARIABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MYSQL_MEMBERSHIP_COLUMN_STATEMENT;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MYSQL_MEMBERSHIP_INDEX_DDL_VARIABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MYSQL_MEMBERSHIP_INDEX_STATEMENT;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.assertCleanBootstrapSchema;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.metricPostStatements;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.metricSchemaStatements;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.runUpgradeScenario;

import java.util.List;
import java.util.function.Predicate;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.MetricMigrationSqlFixture.MigrationScripts;
import org.openmetadata.it.tests.MetricMigrationTestSupport.IndexExpectation;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Execution(ExecutionMode.CONCURRENT)
class MetricMigrationIT {

  @Test
  void migrationFilesContainCompleteMetricAndIncidentManagerStatements() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    MigrationScripts scripts = readMigrationScripts(connectionType);
    List<String> metricSchemaStatements = metricSchemaStatements(scripts);
    List<String> metricPostStatements = metricPostStatements(scripts);

    assertEquals(connectionType == ConnectionType.MYSQL ? 9 : 4, metricSchemaStatements.size());
    assertEquals(1, metricPostStatements.size());
    assertMetricDdlMarkers(metricSchemaStatements, connectionType);
    assertIncidentManagerMarkers(scripts);
    assertMergedStatementOrder(scripts);
  }

  @Test
  void cleanBootstrapContainsMetricAndIncidentManagerSchema() {
    assertCleanBootstrapSchema(TestSuiteBootstrap.getJdbi(), currentConnectionType());
  }

  @Test
  void metricMigrationUpgradesExistingRowsWithoutDataLoss() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    MigrationScripts scripts = readMigrationScripts(connectionType);
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    runUpgradeScenario(jdbi, scripts, connectionType);
  }

  @Test
  void mergedMigrationUpgradesPopulatedPriorShapeFixture() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    MigrationScripts scripts = readMigrationScripts(connectionType);

    runMergedUpgradeScenario(TestSuiteBootstrap.getJdbi(), scripts, connectionType);
  }

  private void assertMetricDdlMarkers(
      List<String> metricStatements, ConnectionType connectionType) {
    String ddl = String.join(System.lineSeparator(), metricStatements);
    assertTrue(ddl.contains("CREATE TABLE IF NOT EXISTS " + METRIC_GROUP_TABLE));
    assertTrue(ddl.contains(METRIC_GROUP_NAME_INDEX));
    assertTrue(ddl.contains(METRIC_GROUP_DELETED_INDEX));
    assertTrue(ddl.contains(MEMBERSHIP_INDEX));
    if (connectionType == ConnectionType.MYSQL) {
      assertTrue(ddl.contains("ADD COLUMN " + MEMBERSHIP_COLUMN));
      assertTrue(ddl.contains("GENERATED ALWAYS AS"));
      assertTrue(ddl.contains(MYSQL_MEMBERSHIP_COLUMN_DDL_VARIABLE));
      assertTrue(ddl.contains(MYSQL_MEMBERSHIP_COLUMN_STATEMENT));
      assertTrue(ddl.contains(MYSQL_MEMBERSHIP_INDEX_DDL_VARIABLE));
      assertTrue(ddl.contains(MYSQL_MEMBERSHIP_INDEX_STATEMENT));
    } else {
      assertTrue(ddl.contains("CREATE UNIQUE INDEX IF NOT EXISTS " + MEMBERSHIP_INDEX));
      assertTrue(ddl.contains("WHERE fromEntity = 'metricGroup'"));
    }
  }

  private void assertIncidentManagerMarkers(MigrationScripts scripts) {
    String schemaSql = String.join(System.lineSeparator(), scripts.schemaStatements());
    String postSql = String.join(System.lineSeparator(), scripts.postStatements());
    assertTrue(schemaSql.contains("CREATE TABLE IF NOT EXISTS " + INCIDENT_TABLE));
    for (IndexExpectation index : INCIDENT_INDEXES) {
      assertTrue(schemaSql.contains(index.name()), index.name());
    }
    assertTrue(postSql.contains("INSERT INTO " + INCIDENT_TABLE));
  }

  private void assertMergedStatementOrder(MigrationScripts scripts) {
    int lastIncidentSchema =
        lastMatchingIndex(scripts.schemaStatements(), this::isIncidentStatement);
    int firstMetricSchema =
        firstMatchingIndex(scripts.schemaStatements(), this::isMetricSchemaStatement);
    int incidentBackfill = firstMatchingIndex(scripts.postStatements(), this::isIncidentStatement);
    int metricBackfill = firstMatchingIndex(scripts.postStatements(), this::isMetricPostStatement);
    assertTrue(lastIncidentSchema >= 0);
    assertTrue(firstMetricSchema > lastIncidentSchema);
    assertTrue(incidentBackfill >= 0);
    assertTrue(metricBackfill > incidentBackfill);
  }

  private int firstMatchingIndex(List<String> statements, Predicate<String> predicate) {
    int result = -1;
    for (int index = 0; index < statements.size() && result < 0; index++) {
      if (predicate.test(statements.get(index))) {
        result = index;
      }
    }
    return result;
  }

  private int lastMatchingIndex(List<String> statements, Predicate<String> predicate) {
    int result = -1;
    for (int index = 0; index < statements.size(); index++) {
      if (predicate.test(statements.get(index))) {
        result = index;
      }
    }
    return result;
  }

  private boolean isMetricSchemaStatement(String statement) {
    return statement.contains(METRIC_GROUP_TABLE)
        || statement.contains(MEMBERSHIP_COLUMN)
        || statement.contains(MEMBERSHIP_INDEX);
  }

  private boolean isMetricPostStatement(String statement) {
    return statement.contains("UPDATE " + METRIC_TABLE);
  }

  private boolean isIncidentStatement(String statement) {
    return statement.contains(INCIDENT_TABLE)
        || statement.contains("idx_test_case")
        || statement.contains("test_case_resolution_status_time_series");
  }
}
