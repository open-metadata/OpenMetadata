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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.openmetadata.service.rdf.RdfQualityFixtures.ASSIGNEE_ID;
import static org.openmetadata.service.rdf.RdfQualityFixtures.BASE;
import static org.openmetadata.service.rdf.RdfQualityFixtures.DQV;
import static org.openmetadata.service.rdf.RdfQualityFixtures.OM;
import static org.openmetadata.service.rdf.RdfQualityFixtures.PROFILED_AT;
import static org.openmetadata.service.rdf.RdfQualityFixtures.PROV;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TABLE_FQN;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TABLE_ID;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TABLE_URI;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TEST_URI;
import static org.openmetadata.service.rdf.RdfQualityFixtures.assignedIncident;
import static org.openmetadata.service.rdf.RdfQualityFixtures.column;
import static org.openmetadata.service.rdf.RdfQualityFixtures.columnTest;
import static org.openmetadata.service.rdf.RdfQualityFixtures.failedResult;
import static org.openmetadata.service.rdf.RdfQualityFixtures.objects;
import static org.openmetadata.service.rdf.RdfQualityFixtures.profileFacts;
import static org.openmetadata.service.rdf.RdfQualityFixtures.profiledTable;
import static org.openmetadata.service.rdf.RdfQualityFixtures.properties;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;

/** The triples a profiled table and a test case project, as a node card reads them. */
class RdfQualityProjectionTest {
  private static final String RAN_AT = Instant.ofEpochMilli(PROFILED_AT).toString();

  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL);
  private final JsonLdTranslator liveTables =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(),
          BASE,
          (type, fqns) ->
              "table".equals(type) && fqns.contains(TABLE_FQN)
                  ? Map.of(TABLE_FQN, TABLE_ID)
                  : Map.of(),
          ReferenceScope.LIVE);

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testcase", "testCase");
  }

  @Test
  void theLatestProfileIsFactsOnTheTableAndOnEachColumn() {
    final Model model = translator.toRdf(profiledTable(100.0, 4.0));

    assertEquals(
        Map.of("profileColumnCount", "2.0", "profileRowCount", "100.0", "profiledAt", RAN_AT),
        profileFacts(model, model.createResource(TABLE_URI)));
    assertEquals(
        Map.of(
            "profileDistinctCount", "95.0",
            "profileMax", "990.5",
            "profileMean", "120.25",
            "profileMin", "-3.0",
            "profileNullCount", "4.0",
            "profileNullProportion", "0.04",
            "profileUniqueCount", "90.0",
            "profileValuesCount", "96.0",
            "profiledAt", RAN_AT),
        profileFacts(model, column(model, "amount")));
    assertEquals(
        Map.of(
            "profileMaxLength", "12.0",
            "profileMinLength", "3.0",
            "profileNullCount", "0.0",
            "profiledAt", RAN_AT),
        profileFacts(model, column(model, "status")));
    assertFalse(
        model.listStatements().toList().stream()
            .anyMatch(statement -> statement.getPredicate().getURI().startsWith(DQV)),
        "the profile is not projected as DQV measurement nodes");
  }

  @Test
  void aTestCaseCarriesItsLatestStatusAndLinksItsTargetsAndTheResultDetails() {
    final Model model = liveTables.toRdf(columnTest("amount", failedResult(PROFILED_AT, 10L)));

    final Resource test = model.createResource(TEST_URI);
    final Resource result = model.createResource(TEST_URI + "/result/latest");
    assertEquals(Set.of(model.createResource(TABLE_URI)), objects(model, test, OM + "testsEntity"));
    assertEquals(Set.of(column(model, "amount")), objects(model, test, OM + "testsColumn"));
    assertEquals(Set.of(result), objects(model, test, OM + "hasTestResult"));
    assertEquals("Failed", properties(model, test).get(OM + "latestResultStatus"));
    assertEquals(RAN_AT, properties(model, test).get(OM + "latestResultAt"));
    assertEquals(
        Map.of(
            RDF.type.getURI(),
            OM + "TestCaseResult",
            OM + "testResultStatus",
            "Failed",
            OM + "testResultMessage",
            "Found min=-3, expected >= 0",
            PROV + "generatedAtTime",
            RAN_AT,
            OM + "passedRows",
            "90",
            OM + "failedRows",
            "10",
            OM + "minBound",
            "0.0",
            OM + "maxBound",
            "1000.0",
            OM + "hasResultValue",
            TEST_URI + "/result/latest/value/0"),
        properties(model, result));
    assertEquals(
        Map.of(
            RDF.type.getURI(),
            OM + "TestResultValue",
            RDFS.label.getURI(),
            "min",
            DQV + "value",
            "-3"),
        properties(model, model.createResource(TEST_URI + "/result/latest/value/0")));
  }

  @Test
  void aTestCaseWhoseTableIsNotLiveLinksNoTable() {
    final Model model = translator.toRdf(columnTest("amount", failedResult(PROFILED_AT, 10L)));

    assertEquals(Set.of(), objects(model, model.createResource(TEST_URI), OM + "testsEntity"));
  }

  @Test
  void anOpenIncidentIsLinkedWithItsStateSeverityAndAssignee() {
    final TestCase testCase =
        columnTest("amount", failedResult(PROFILED_AT, 10L)).withIncidentStatus(assignedIncident());

    final Model model = translator.toRdf(testCase);

    final Resource incident = model.createResource(TEST_URI + "/incident/open");
    assertEquals(
        Set.of(incident), objects(model, model.createResource(TEST_URI), OM + "hasOpenIncident"));
    assertEquals(
        Map.of(
            RDF.type.getURI(),
            OM + "TestCaseIncident",
            OM + "incidentState",
            "Assigned",
            OM + "incidentSeverity",
            "Severity2",
            OM + "incidentAssignee",
            BASE + "entity/user/" + ASSIGNEE_ID,
            PROV + "generatedAtTime",
            RAN_AT),
        properties(model, incident));
    assertFalse(
        properties(model, model.createResource(TEST_URI)).containsKey(OM + "incidentStatus"),
        "the incident is no longer an opaque JSON literal");
  }
}
