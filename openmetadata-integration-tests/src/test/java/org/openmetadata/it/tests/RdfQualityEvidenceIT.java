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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.columnTest;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.enableAutoCloseIncident;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.postResult;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.putProfile;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.table;
import static org.openmetadata.it.tests.RdfQualityEvidenceFixtures.tagSensitive;
import static org.openmetadata.it.util.RdfGraphAssertions.BASE_URI;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitCount;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitPresent;
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
    final TestCase onAmount = columnTest(client, namespace, table, "amount");
    final String test = "<" + BASE_URI + "entity/testCase/" + onAmount.getId() + ">";
    final long ranAt = System.currentTimeMillis() - MINUTE;

    postResult(client, onAmount, ranAt, TestCaseStatus.Failed, 3L);
    awaitCount(test + " " + om("latestResultStatus") + " \"Failed\"", 1);
    awaitCount(
        test + " " + om("hasTestResult") + "/" + om("failedRows") + " ?rows FILTER(?rows = 3)", 1);
    awaitPresent(test + " " + om("hasOpenIncident") + "/" + om("incidentState") + " ?state");

    enableAutoCloseIncident(client, onAmount);
    postResult(client, onAmount, ranAt + MINUTE / 2, TestCaseStatus.Success, 0L);
    awaitCount(test + " " + om("latestResultStatus") + " \"Success\"", 1);
    awaitCount(test + " " + om("hasTestResult") + "/" + om("failedRows") + " ?rows", 1);
    awaitCount(test + " " + om("hasOpenIncident") + " ?incident", 0);

    tagSensitive(client, table, "amount");
    awaitCount(test + " " + om("hasTestResult") + " ?result", 0);
    awaitCount(test + " " + om("latestResultStatus") + " ?status", 0);
    awaitCount(test + " " + om("incrementalChangeDescription") + " ?change", 0);

    client.testCases().delete(onAmount.getId().toString(), HARD_DELETE);
    awaitCount(
        "{ "
            + test
            + " ?p ?o } UNION { <"
            + BASE_URI
            + "entity/testCase/"
            + onAmount.getId()
            + "/result/latest> ?p ?o }",
        0);
  }

  @ParameterizedTest
  @ValueSource(strings = {"jsonld", "turtle", "rdfxml", "ntriples"})
  void entityRdfMasksSensitiveColumnTestEvidence(
      final String format, final TestNamespace namespace) {
    final Table table = table(namespace);
    final TestCase sensitive = columnTest(client, namespace, table, "email");
    final TestCase visible = columnTest(client, namespace, table, "status");
    final String message = "quality-result-marker";
    final String observed = "quality-observation-marker";
    postTestEvidence(sensitive, message, observed);
    postTestEvidence(visible, message, observed);

    final User user = UserTestFactory.createUser(namespace, "rdf_evidence_reader");
    final OpenMetadataClient reader =
        SdkClients.createClient(user.getEmail(), user.getEmail(), new String[0]);
    assertNull(
        reader.testCases().get(sensitive.getId().toString(), "testCaseResult").getTestCaseResult());

    final String visibleBody = entityRdf(reader, visible, format);
    assertTrue(visibleBody.contains(message) && visibleBody.contains(observed), visibleBody);
    final String maskedBody = entityRdf(reader, sensitive, format);
    assertTrue(maskedBody.contains(sensitive.getId().toString()), maskedBody);
    assertFalse(maskedBody.contains(message) || maskedBody.contains(observed), maskedBody);
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
