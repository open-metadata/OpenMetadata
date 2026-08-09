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

import static org.openmetadata.it.tests.MetricMigrationTestSupport.INCIDENT_TABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.MEMBERSHIP_INDEX;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_GROUP_DELETED_INDEX;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_GROUP_NAME_INDEX;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_GROUP_TABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.METRIC_TABLE;
import static org.openmetadata.it.tests.MetricMigrationTestSupport.RELATIONSHIP_TABLE;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

record MergedMetricMigrationFixture(String suffix) {
  private static final String RESOLUTION_STATUS_TABLE = "test_case_resolution_status_time_series";
  private static final String TEST_CASE_TABLE = "test_case";

  static MergedMetricMigrationFixture create() {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    return new MergedMetricMigrationFixture(suffix);
  }

  String rewrite(String statement) {
    String rewritten = statement;
    for (Replacement replacement : replacements()) {
      rewritten = rewritten.replace(replacement.source(), replacement.target());
    }
    return rewritten;
  }

  private List<Replacement> replacements() {
    return List.of(
        replacement("idx_test_case_resolution_status_state_id", "resolution_state_idx"),
        replacement("idx_test_case_resolution_status_fqn_ts", "resolution_fqn_idx"),
        replacement("idx_test_case_resolution_status_assignee", "resolution_assignee_idx"),
        replacement("idx_test_case_id", "tc_id_idx"),
        replacement("idx_tci_status_fqn", "incident_status_fqn_idx"),
        replacement("idx_tci_fqn", "incident_fqn_idx"),
        replacement("idx_tci_assignee", "incident_assignee_idx"),
        replacement("idx_tci_updated", "incident_updated_idx"),
        replacement(METRIC_GROUP_NAME_INDEX, "group_name_idx"),
        replacement(METRIC_GROUP_DELETED_INDEX, "group_deleted_idx"),
        replacement(MEMBERSHIP_INDEX, "membership_idx"),
        new Replacement(RESOLUTION_STATUS_TABLE, resolutionStatusTable()),
        new Replacement(INCIDENT_TABLE, incidentTable()),
        new Replacement(METRIC_GROUP_TABLE, metricGroupTable()),
        new Replacement(RELATIONSHIP_TABLE, relationshipTable()),
        new Replacement(METRIC_TABLE, metricTable()),
        new Replacement(TEST_CASE_TABLE, testCaseTable()));
  }

  private Replacement replacement(String source, String targetRole) {
    return new Replacement(source, identifier(targetRole));
  }

  String resolutionStatusTable() {
    return identifier("resolution_status");
  }

  String testCaseTable() {
    return identifier("test_case");
  }

  String incidentTable() {
    return identifier("incident");
  }

  String metricGroupTable() {
    return identifier("metric_group");
  }

  String relationshipTable() {
    return identifier("relationship");
  }

  String metricTable() {
    return identifier("metric");
  }

  String groupNameIndex() {
    return identifier("group_name_idx");
  }

  String groupDeletedIndex() {
    return identifier("group_deleted_idx");
  }

  String membershipIndex() {
    return identifier("membership_idx");
  }

  List<IndexTarget> incidentIndexes() {
    return List.of(
        index(resolutionStatusTable(), "resolution_state_idx"),
        index(resolutionStatusTable(), "resolution_fqn_idx"),
        index(resolutionStatusTable(), "resolution_assignee_idx"),
        index(testCaseTable(), "tc_id_idx"),
        index(incidentTable(), "incident_status_fqn_idx"),
        index(incidentTable(), "incident_fqn_idx"),
        index(incidentTable(), "incident_assignee_idx"),
        index(incidentTable(), "incident_updated_idx"));
  }

  private IndexTarget index(String table, String indexRole) {
    return new IndexTarget(table, identifier(indexRole));
  }

  private String identifier(String role) {
    return ("it_mm_" + role + "_" + suffix).toLowerCase(Locale.ROOT);
  }

  private record Replacement(String source, String target) {}
}

record IndexTarget(String table, String index) {}
