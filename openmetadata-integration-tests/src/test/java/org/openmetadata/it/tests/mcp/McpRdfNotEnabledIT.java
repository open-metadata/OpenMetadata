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

package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;

/**
 * What an MCP client sees on a deployment without the RDF store. The server withholds the tools that
 * cannot run from {@code tools/list} and refuses a direct call to them, so a client is never offered
 * a tool that fails. {@code ontology_describe} stays offered because the bundled ontology needs no
 * store; describing a resource does, and answers with a clear "not enabled" message to administrators
 * and to callers who hold only the query grant. Runs in the default lane: in the RDF lane the store is
 * on and {@code RdfMcpKnowledgeGraphIT} covers the tools.
 */
public class McpRdfNotEnabledIT extends McpTestBase {
  private static final Set<String> WITHHELD =
      Set.of("sparql_query", "entity_neighborhood", "find_by_tag", "shacl_validate");
  private static final String RESOURCE = "https://open-metadata.org/ontology/Table";
  private static RdfAccessFixtures access;
  private static String grantedToken;

  @BeforeAll
  static void setUp() throws Exception {
    assumeFalse(RdfTestUtils.isRdfEnabled(), "The RDF lane covers the tools with the store on");
    initAuth();
    access = new RdfAccessFixtures("rdfoff");
    final var grant = access.allowRole(MetadataOperation.EXECUTE_SPARQL_QUERY, Entity.RDF);
    grantedToken = "Bearer " + access.userToken("granted", List.of(grant.getId()));
  }

  @AfterAll
  static void tearDown() {
    if (access != null) {
      access.close();
    }
  }

  @Test
  void theToolsThatNeedTheStoreAreNotOffered() throws Exception {
    final JsonNode list =
        executeMcpRequest(McpTestUtils.createJsonRpcRequest("tools/list", Map.of()), authToken);
    final Set<String> offered = new HashSet<>();
    list.path("result").path("tools").forEach(tool -> offered.add(tool.path("name").asText()));

    assertThat(offered).doesNotContainAnyElementsOf(WITHHELD).contains("ontology_describe");
  }

  @Test
  void aDirectCallToAWithheldToolDoesNotSucceed() throws Exception {
    final JsonNode response =
        executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "sparql_query", Map.of("query", "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1")),
            grantedToken);

    final boolean refused =
        response.has("error") || response.path("result").path("isError").asBoolean(false);
    assertThat(refused).as(response.toString()).isTrue();
  }

  @Test
  void anAdministratorDescribingAResourceIsToldTheGraphIsNotEnabled() throws Exception {
    assertNotEnabled(authToken);
  }

  @Test
  void aGrantedUserDescribingAResourceIsToldTheGraphIsNotEnabled() throws Exception {
    assertNotEnabled(grantedToken);
  }

  private void assertNotEnabled(final String token) throws Exception {
    final JsonNode result =
        executeMcpRequest(
                McpTestUtils.createToolCallRequest(
                    "ontology_describe", Map.of("resource", RESOURCE, "maxBytes", 2048)),
                token)
            .path("result");

    assertThat(result.path("isError").asBoolean()).as(result.toString()).isTrue();
    final JsonNode error =
        OBJECT_MAPPER.readTree(result.path("content").path(0).path("text").asText());
    assertThat(error.path("statusCode").asInt()).isEqualTo(400);
    assertThat(error.path("error").asText()).contains("RDF knowledge graph is not enabled");
  }
}
