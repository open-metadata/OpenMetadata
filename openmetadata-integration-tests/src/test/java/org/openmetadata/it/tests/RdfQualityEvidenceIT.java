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

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.enableAutoCloseIncident;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.postResult;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.putProfile;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.table;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.tagSensitive;
import static org.openmetadata.it.util.RdfGraphAssertions.BASE_URI;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitCount;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitPresent;
import static org.openmetadata.it.util.RdfGraphAssertions.count;
import static org.openmetadata.it.util.RdfGraphAssertions.iri;
import static org.openmetadata.it.util.RdfGraphAssertions.om;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestResultValue;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.rdf.RdfUpdater;

/**
 * Profiles, test results and incidents written through the API reach the live graph as their
 * latest values only, follow the PII rule and leave with their entities
 * (ADR:2026-11-18-the-rdf-graph-carries-the-latest-quality-evidence).
 */
@ExtendWith(TestNamespaceExtension.class)
public class RdfQualityEvidenceIT {
  private static final Map<String, String> HARD_DELETE =
      Map.of("hardDelete", "true", "recursive", "true");
  private static final long MINUTE = 60_000L;
  private static final String PARAMETER_MARKER = "quality-regex-marker";
  private static final String DESCRIPTION_MARKER = "quality-description-marker";

  private final OpenMetadataClient client = SdkClients.adminClient();

  @BeforeAll
  static void enableLiveProjection() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    if (!RdfUpdater.isEnabled()) {
      RdfUpdater.initialize(
          new RdfConfiguration()
              .withEnabled(true)
              .withBaseUri(URI.create(BASE_URI))
              .withStorageType(RdfConfiguration.StorageType.FUSEKI)
              .withRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()))
              .withDataset("openmetadata")
              .withUsername("admin")
              .withPassword("test-admin"));
    }
  }

  @Test
  void aProfileReachesTheGraphAsLatestFactsAndLeavesWithTheTable(final TestNamespace namespace) {
    final Table table = table(namespace);
    final long first = System.currentTimeMillis() - MINUTE;
    putProfile(client, table, first, 100.0, 4.0);
    awaitCount(fact(iri("table", table), "profileRowCount", "100"), 1);
    awaitCount(fact(column(table, "amount"), "profileNullCount", "4"), 1);

    putProfile(client, table, first + MINUTE / 2, 250.0, 9.0);
    awaitCount(fact(iri("table", table), "profileRowCount", "250"), 1);
    awaitCount(column(table, "amount") + " " + om("profileNullCount") + " ?value", 1);
    awaitCount(iri("table", table) + " " + om("profileRowCount") + " ?value", 1);
    awaitCount(profileFacts(column(table, "email")), 0);

    client.tables().delete(table.getId().toString(), HARD_DELETE);
    awaitCount(profileFacts(iri("table", table)), 0);
    awaitCount(profileFacts(column(table, "amount")), 0);
  }

  @Test
  void aTestCarriesItsLatestResultAndOpenIncidentUntilTheColumnTurnsSensitive(
      final TestNamespace namespace) throws Exception {
    final Table table = table(namespace);
    final TestCase onStatus = regexTest(namespace, table, "status");
    final String test = iri("testCase", onStatus);
    final String parameters = test + " " + om("hasParameterValue") + " ?parameters";
    final String description = test + " <http://purl.org/dc/terms/description> ?description";
    final String changes = test + " " + om("incrementalChangeDescription") + " ?change";
    final long ranAt = System.currentTimeMillis() - MINUTE;

    postResult(client, onStatus, ranAt, TestCaseStatus.Failed, 3L);
    awaitCount(test + " " + om("latestResultStatus") + " \"Failed\"", 1);
    awaitCount(
        test + " " + om("hasTestResult") + "/" + om("failedRows") + " ?rows FILTER(?rows = 3)", 1);
    awaitPresent(test + " " + om("hasOpenIncident") + "/" + om("incidentState") + " ?state");

    enableAutoCloseIncident(client, onStatus);
    postResult(client, onStatus, ranAt + MINUTE / 2, TestCaseStatus.Success, 0L);
    awaitCount(test + " " + om("latestResultStatus") + " \"Success\"", 1);
    awaitCount(test + " " + om("hasTestResult") + "/" + om("failedRows") + " ?rows", 1);
    awaitCount(test + " " + om("hasOpenIncident") + " ?incident", 0);

    awaitPresent(changes);
    awaitPresent(parameters + " FILTER(CONTAINS(STR(?parameters), \"" + PARAMETER_MARKER + "\"))");
    awaitPresent(description + " FILTER(STR(?description) = \"" + DESCRIPTION_MARKER + "\")");

    tagSensitive(client, table, "status");
    awaitCount(test + " " + om("hasTestResult") + " ?result", 0);
    awaitCount(test + " " + om("latestResultStatus") + " ?status", 0);
    awaitCount(changes, 0);
    assertAll(
        () -> assertEquals(0, count(parameters), "Test parameter leaked into the graph"),
        () -> assertEquals(0, count(description), "Test description leaked into the graph"));

    client.testCases().delete(onStatus.getId().toString(), HARD_DELETE);
    awaitCount(
        "{ "
            + test
            + " ?p ?o } UNION { <"
            + BASE_URI
            + "entity/testCase/"
            + onStatus.getId()
            + "/result/latest> ?p ?o }",
        0);
  }

  @ParameterizedTest
  @ValueSource(strings = {"jsonld", "turtle", "rdfxml", "ntriples"})
  void entityRdfMasksSensitiveColumnTestEvidence(
      final String format, final TestNamespace namespace) {
    final Table table = table(namespace);
    final TestCase sensitive = regexTest(namespace, table, "email");
    final TestCase visible = regexTest(namespace, table, "status");
    final String message = "quality-result-marker";
    final String observed = "quality-observation-marker";
    postTestEvidence(sensitive, message, observed);
    postTestEvidence(visible, message, observed);

    final User user = UserTestFactory.createUser(namespace, "rdf_evidence_reader");
    final OpenMetadataClient reader =
        SdkClients.createClient(user.getEmail(), user.getEmail(), new String[0]);
    final TestCase maskedCase =
        reader.testCases().get(sensitive.getId().toString(), "testCaseResult");
    assertAll(
        () -> assertNull(maskedCase.getTestCaseResult()),
        () -> assertTrue(nullOrEmpty(maskedCase.getParameterValues())),
        () -> assertNull(maskedCase.getDescription()));

    final String visibleBody = entityRdf(reader, visible, format);
    assertAll(
        () -> assertTrue(visibleBody.contains(message), visibleBody),
        () -> assertTrue(visibleBody.contains(observed), visibleBody),
        () -> assertTrue(visibleBody.contains(PARAMETER_MARKER), visibleBody),
        () -> assertTrue(visibleBody.contains(DESCRIPTION_MARKER), visibleBody));
    final String maskedBody = entityRdf(reader, sensitive, format);
    assertTrue(maskedBody.contains(sensitive.getId().toString()), maskedBody);
    assertAll(
        () -> assertFalse(maskedBody.contains(message), "Result message leaked"),
        () -> assertFalse(maskedBody.contains(observed), "Observed value leaked"),
        () -> assertFalse(maskedBody.contains(PARAMETER_MARKER), "Test parameter leaked"),
        () -> assertFalse(maskedBody.contains(DESCRIPTION_MARKER), "Test description leaked"));
  }

  private TestCase regexTest(
      final TestNamespace namespace, final Table table, final String column) {
    return TestCaseBuilder.create(client)
        .name(namespace.prefix(column + "_regex"))
        .forColumn(table, column)
        .testDefinition("columnValuesToMatchRegex")
        .parameter("regex", PARAMETER_MARKER)
        .description(DESCRIPTION_MARKER)
        .create();
  }

  private void postTestEvidence(
      final TestCase testCase, final String message, final String observed) {
    client
        .testCaseResults()
        .create(
            testCase.getFullyQualifiedName(),
            new CreateTestCaseResult()
                .withTimestamp(System.currentTimeMillis() - MINUTE)
                .withTestCaseStatus(TestCaseStatus.Failed)
                .withResult(message)
                .withTestResultValue(
                    List.of(new TestResultValue().withName("actual").withValue(observed))));
  }

  private static String entityRdf(
      final OpenMetadataClient reader, final TestCase testCase, final String format) {
    return reader
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/rdf/entity/testCase/" + testCase.getId() + "?format=" + format,
            null);
  }

  private static String fact(final String subject, final String predicate, final String number) {
    return subject + " " + om(predicate) + " ?value FILTER(?value = " + number + ")";
  }

  private static String profileFacts(final String subject) {
    return subject + " ?p ?value FILTER(STRSTARTS(STR(?p), \"" + BASE_URI + "ontology/profile\"))";
  }

  private static String column(final Table table, final String name) {
    final String fqn = table.getFullyQualifiedName() + "." + name;
    return "<" + BASE_URI + "entity/column/" + URLEncoder.encode(fqn, StandardCharsets.UTF_8) + ">";
  }
}
