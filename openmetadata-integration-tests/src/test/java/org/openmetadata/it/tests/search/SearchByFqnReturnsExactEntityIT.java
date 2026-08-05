package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.tests.search.RankingSupport.SearchResult;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * Searching the {@code dataAsset} alias with an apiEndpoint's full FQN must return that endpoint
 * only — never its parent apiCollection, whose name is a lexical substring of the endpoint FQN.
 *
 * <p>Before the fuzzy ranking-stage fix, a multi-token FQN query ran the fuzzy stage with fuzziness
 * disabled, degenerating into a permissive OR match: the collection cleared {@code
 * minimumShouldMatch:"2<70%"} on shared name sub-tokens and even outranked the exact endpoint. This
 * pins the corrected behavior. The names mirror the reported pattern (shared {@code pw-api-} prefix +
 * hex suffixes) that the compound analyzer explodes into the tiny shared tokens driving the false
 * positive.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class SearchByFqnReturnsExactEntityIT {

  private static final String DATA_ASSET_INDEX = "dataAsset";

  private record EndpointChain(String collectionFqn, String endpointFqn) {}

  @Test
  void endpointFqnQueryDoesNotReturnParentCollection(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    EndpointChain chain = seedEndpointChain(client, ns);

    boolean indexed =
        RankingSupport.awaitTrue(
            () ->
                RankingSupport.search(client, DATA_ASSET_INDEX, chain.endpointFqn())
                    .contains(chain.endpointFqn()));
    assertTrue(indexed, "endpoint not searchable by its FQN: " + chain.endpointFqn());

    SearchResult result = RankingSupport.search(client, DATA_ASSET_INDEX, chain.endpointFqn());
    List<String> fqns = result.hits().stream().map(hit -> hit.fqn()).toList();
    assertFalse(
        fqns.contains(chain.collectionFqn()),
        "parent apiCollection must not match an endpoint-FQN query, got: " + fqns);
    assertEquals(
        chain.endpointFqn(),
        result.hits().getFirst().fqn(),
        "endpoint with the exact FQN must be the top hit, got: " + fqns);
  }

  private EndpointChain seedEndpointChain(OpenMetadataClient client, TestNamespace ns) {
    ApiService service =
        ns.trackRoot(
            Entity.API_SERVICE,
            client
                .apiServices()
                .create(
                    new CreateApiService()
                        .withName(ns.prefix("pw-api-service-" + ns.uniqueShortId()))
                        .withServiceType(CreateApiService.ApiServiceType.Rest)));
    String collectionFqn =
        client
            .apiCollections()
            .create(
                new CreateAPICollection()
                    .withName(ns.prefix("pw-api-collection-" + ns.uniqueShortId()))
                    .withService(service.getFullyQualifiedName()))
            .getFullyQualifiedName();
    String endpointFqn =
        client
            .apiEndpoints()
            .create(
                new CreateAPIEndpoint()
                    .withName(ns.prefix("pw-api-endpoint-" + ns.uniqueShortId()))
                    .withApiCollection(collectionFqn))
            .getFullyQualifiedName();
    return new EndpointChain(collectionFqn, endpointFqn);
  }
}
