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

package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestResultValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;

/** A profiled table, a test on it and the stored evidence about both, for the quality tests. */
public final class RdfQualityFixtures {
  public static final String BASE = "https://open-metadata.org/";
  static final String OM = BASE + "ontology/";
  static final String DQV = "http://www.w3.org/ns/dqv#";
  static final String PROV = "http://www.w3.org/ns/prov#";
  static final String GRAPH = BASE + "graph/knowledge";
  public static final String TABLE_FQN = "svc.db.schema.orders";
  static final UUID TABLE_ID = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
  public static final String TABLE_URI = BASE + "entity/table/" + TABLE_ID;
  static final UUID TEST_ID = UUID.fromString("00000000-0000-0000-0000-0000000000d1");
  public static final String TEST_URI = BASE + "entity/testCase/" + TEST_ID;
  static final UUID ASSIGNEE_ID = UUID.fromString("00000000-0000-0000-0000-0000000000e1");
  public static final long PROFILED_AT = 1_763_000_000_000L;

  private RdfQualityFixtures() {}

  public static Table profiledTable(final double rowCount, final double nullCount) {
    final Column amount =
        new Column()
            .withName("amount")
            .withFullyQualifiedName(TABLE_FQN + ".amount")
            .withDataType(ColumnDataType.DECIMAL)
            .withProfile(
                new ColumnProfile()
                    .withName("amount")
                    .withTimestamp(PROFILED_AT)
                    .withValuesCount(96.0)
                    .withNullCount(nullCount)
                    .withNullProportion(nullCount / 100.0)
                    .withDistinctCount(95.0)
                    .withUniqueCount(90.0)
                    .withMin(-3.0)
                    .withMax(990.5)
                    .withMean(120.25)
                    .withSum(11_544.0)
                    .withStddev(8.5)
                    .withMedian(99.0));
    final Column status =
        new Column()
            .withName("status")
            .withFullyQualifiedName(TABLE_FQN + ".status")
            .withDataType(ColumnDataType.VARCHAR)
            .withProfile(
                new ColumnProfile()
                    .withName("status")
                    .withTimestamp(PROFILED_AT)
                    .withNullCount(0.0)
                    .withMin("CANCELLED")
                    .withMax("SHIPPED")
                    .withMinLength(3.0)
                    .withMaxLength(12.0));
    return new Table()
        .withId(TABLE_ID)
        .withName("orders")
        .withFullyQualifiedName(TABLE_FQN)
        .withColumns(List.of(amount, status))
        .withProfile(
            new TableProfile()
                .withTimestamp(PROFILED_AT)
                .withRowCount(rowCount)
                .withColumnCount(2.0));
  }

  static Column nestedColumn(final String parent, final String name) {
    return new Column()
        .withName(name)
        .withFullyQualifiedName(TABLE_FQN + "." + parent + "." + name)
        .withDataType(ColumnDataType.VARCHAR);
  }

  public static TagLabel sensitive() {
    return new TagLabel()
        .withTagFQN("PII.Sensitive")
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  static void clearProfiles(final Table table) {
    table.setProfile(null);
    table.getColumns().forEach(column -> column.setProfile(null));
  }

  public static TestCase columnTest(final String column, final TestCaseResult latest) {
    return new TestCase()
        .withId(TEST_ID)
        .withName(column + "_positive")
        .withFullyQualifiedName(TABLE_FQN + "." + column + "." + column + "_positive")
        .withEntityLink("<#E::table::" + TABLE_FQN + "::columns::" + column + ">")
        .withEntityFQN(TABLE_FQN + "." + column)
        .withTestCaseResult(latest);
  }

  public static TestCaseResult failedResult(final long timestamp, final long failedRows) {
    return new TestCaseResult()
        .withTimestamp(timestamp)
        .withTestCaseStatus(TestCaseStatus.Failed)
        .withResult("Found min=-3, expected >= 0")
        .withSampleData("row 17: -3")
        .withPassedRows(100L - failedRows)
        .withFailedRows(failedRows)
        .withMinBound(0.0)
        .withMaxBound(1000.0)
        .withTestResultValue(List.of(new TestResultValue().withName("min").withValue("-3")));
  }

  public static TestCaseResolutionStatus assignedIncident() {
    return new TestCaseResolutionStatus()
        .withStateId(UUID.randomUUID())
        .withTimestamp(PROFILED_AT)
        .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
        .withSeverity(Severity.Severity2)
        .withTestCaseResolutionStatusDetails(
            new Assigned()
                .withAssignee(
                    new EntityReference().withId(ASSIGNEE_ID).withType("user").withName("ada")));
  }

  static Resource column(final Model model, final String name) {
    return model.createResource(RdfUtils.columnUri(BASE, TABLE_FQN + "." + name));
  }

  static Set<Resource> objects(final Model model, final Resource subject, final String predicate) {
    return Set.copyOf(
        model
            .listObjectsOfProperty(subject, model.createProperty(predicate))
            .mapWith(RDFNode::asResource)
            .toList());
  }

  /** Every property of {@code subject}, by predicate IRI, with an IRI or lexical-form value. */
  static Map<String, String> properties(final Model model, final Resource subject) {
    final Map<String, String> properties = new TreeMap<>();
    model
        .listStatements(subject, null, (RDFNode) null)
        .forEachRemaining(
            statement ->
                properties.merge(
                    statement.getPredicate().getURI(),
                    statement.getObject().isResource()
                        ? statement.getResource().getURI()
                        : statement.getLiteral().getLexicalForm(),
                    (first, second) -> first + "," + second));
    return properties;
  }

  /** The {@code om:profile*} facts and {@code om:profiledAt} of {@code subject}. */
  static Map<String, String> profileFacts(final Model model, final Resource subject) {
    final Map<String, String> facts = new TreeMap<>();
    properties(model, subject).entrySet().stream()
        .filter(entry -> entry.getKey().startsWith(OM + "profile"))
        .forEach(entry -> facts.put(entry.getKey().substring(OM.length()), entry.getValue()));
    return facts;
  }

  /** Stored evidence read the way the database source reads it: latest rows, by FQN. */
  static final class FakeEvidence implements RdfQualityEvidenceSource {
    final Map<String, TableProfile> tableProfiles = new HashMap<>();
    final Map<String, ColumnProfile> columnProfiles = new HashMap<>();
    final Map<String, List<TagLabel>> columnTags = new HashMap<>();
    final Map<String, TestCaseResult> results = new HashMap<>();
    final Map<String, TestCaseResolutionStatus> incidents = new HashMap<>();
    final Map<String, Table> tables = new HashMap<>();
    final List<List<String>> columnReads = new ArrayList<>();

    static FakeEvidence storing(final Table table) {
      final FakeEvidence evidence = new FakeEvidence();
      evidence.tableProfiles.put(table.getFullyQualifiedName(), table.getProfile());
      table
          .getColumns()
          .forEach(
              column ->
                  evidence.columnProfiles.put(column.getFullyQualifiedName(), column.getProfile()));
      evidence.tables.put(table.getFullyQualifiedName(), table);
      return evidence;
    }

    @Override
    public Map<String, TableProfile> latestTableProfiles(final List<String> tableFqns) {
      return pick(tableProfiles, tableFqns);
    }

    @Override
    public Map<String, ColumnProfile> latestColumnProfiles(final List<String> columnFqns) {
      columnReads.add(List.copyOf(columnFqns));
      return pick(columnProfiles, columnFqns);
    }

    @Override
    public Map<String, List<TagLabel>> columnTags(final Table table) {
      return Map.copyOf(columnTags);
    }

    @Override
    public Map<String, TestCaseResult> latestTestCaseResults(final List<String> testCaseFqns) {
      return pick(results, testCaseFqns);
    }

    @Override
    public Map<String, TestCaseResolutionStatus> latestIncidentStatuses(
        final List<String> testCaseFqns) {
      return pick(incidents, testCaseFqns);
    }

    @Override
    public Optional<Table> liveTable(final String tableFqn) {
      return Optional.ofNullable(tables.get(tableFqn));
    }

    private static <T> Map<String, T> pick(final Map<String, T> stored, final List<String> fqns) {
      final Map<String, T> picked = new HashMap<>();
      fqns.stream().filter(stored::containsKey).forEach(fqn -> picked.put(fqn, stored.get(fqn)));
      return picked;
    }
  }
}
