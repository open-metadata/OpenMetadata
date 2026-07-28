/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * Regression test for the ML model service search alias bug: querying {@code index=mlModelService}
 * must return only ML model <em>services</em>, never ML model <em>assets</em>.
 *
 * <p>The mlModel asset lists {@code mlModelService} as a {@code parentAlias}, so the ES alias
 * {@code mlModelService} is attached to both {@code mlmodel_service_search_index} and
 * {@code mlmodel_search_index}. For every other {@code *Service} the search resolver collapses the
 * alias token to the single concrete service index, but the ML service's {@code entityIndexMap} key
 * ({@code mlmodelService}) differs in casing from its alias ({@code mlModelService}) that clients
 * send, so the by-key lookup missed and the token fell through to ES-native alias expansion —
 * pulling in assets. Resolving the token by the entity's alias (not just its key) fixes it.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class MlModelServiceSearchAliasIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final Duration POLL_AT_MOST = Duration.ofSeconds(60);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final String MLMODEL_SERVICE_INDEX = "mlModelService";
  private static final String MLMODEL_INDEX = "mlmodel";

  @Test
  @DisplayName("index=mlModelService returns only services, not mlModel assets")
  void mlModelServiceAliasDoesNotLeakAssets(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);
    String serviceFqn = service.getFullyQualifiedName();
    String assetName = ns.prefix("mlmodel_alias_asset");
    MlModel asset =
        ns.trackRoot(
            Entity.MLMODEL,
            client
                .mlModels()
                .create(
                    new CreateMlModel()
                        .withName(assetName)
                        .withService(serviceFqn)
                        .withAlgorithm("regression")));
    String assetFqn = asset.getFullyQualifiedName();

    JsonNode assetHit = awaitHitByFqn(client, MLMODEL_INDEX, assetName, assetFqn);
    assertEquals(
        Entity.MLMODEL,
        assetHit.path("entityType").asText(),
        "asset must be reachable via its own index with entityType 'mlmodel'");

    JsonNode serviceHit = awaitHitByFqn(client, MLMODEL_SERVICE_INDEX, serviceFqn, serviceFqn);
    assertEquals(
        Entity.MLMODEL_SERVICE,
        serviceHit.path("entityType").asText(),
        "service must be reachable via the mlModelService alias");

    JsonNode leakedAsset = findHitByFqn(client, MLMODEL_SERVICE_INDEX, assetName, assetFqn);
    assertNull(
        leakedAsset,
        "index=mlModelService must not return the mlModel asset " + assetFqn + " (alias leak)");
  }

  /**
   * Poll {@code index} for {@code query} until a hit whose FQN equals {@code fqn} appears, then
   * return its {@code _source}. ES indexing is async after the write API returns, so a fixed sleep
   * flakes; this waits for convergence.
   */
  private JsonNode awaitHitByFqn(
      OpenMetadataClient client, String index, String query, String fqn) {
    JsonNode[] match = new JsonNode[1];
    Awaitility.await(fqn + " indexed in " + index)
        .pollInterval(POLL_INTERVAL)
        .atMost(POLL_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode source = findHitByFqn(client, index, query, fqn);
              assertNotNull(source, fqn + " not yet indexed in " + index);
              match[0] = source;
            });
    return match[0];
  }

  private JsonNode findHitByFqn(OpenMetadataClient client, String index, String query, String fqn)
      throws Exception {
    String response = client.search().query(query).index(index).size(50).deleted(false).execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    JsonNode result = null;
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (fqn.equals(source.path("fullyQualifiedName").asText(""))) {
        result = source;
        break;
      }
    }
    return result;
  }
}
