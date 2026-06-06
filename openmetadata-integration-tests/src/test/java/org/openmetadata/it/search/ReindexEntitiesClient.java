package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Wraps {@code POST /v1/search/reindexEntities} — the per-entity refresh path
 * that observability tests use to validate "does the doc shape survive an
 * in-place rebuild?"
 *
 * <p>The endpoint is async (returns 202 immediately, runs the reindex on
 * {@code AsyncService.executorService}). Callers need a deterministic wait so
 * the post-reindex UI render reflects fresh state, not stale. This helper
 * polls the search engine until every targeted entity id is present in its
 * alias and gives up after 30 s.
 *
 * <p>Always uses {@code recreate=true} — that's the harder path (delete-then-add
 * exposes the brief gap where the doc is absent) and the one the user wants
 * exercised by every observability UIIT.
 */
public final class ReindexEntitiesClient {

  public static final Duration DEFAULT_WAIT = Duration.ofSeconds(30);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);

  private final ServerHandle server;
  private final SearchClient search;
  private final IndexAliasInspector inspector;

  public ReindexEntitiesClient(final ServerHandle server) {
    this.server = server;
    this.search = new SearchClient(server);
    this.inspector = new IndexAliasInspector(server);
  }

  /**
   * Triggers a recreate reindex for every entity in {@code refs} and blocks
   * until each one is present again in its alias (or 30 s elapses).
   */
  public void recreateAndAwait(final List<EntityReference> refs) {
    recreateAndAwait(refs, DEFAULT_WAIT);
  }

  public void recreateAndAwait(final List<EntityReference> refs, final Duration maxWait) {
    if (refs == null || refs.isEmpty()) {
      throw new IllegalArgumentException("entity reference list must not be empty");
    }
    trigger(refs);
    awaitAllPresent(refs, maxWait);
  }

  /**
   * Convenience overload — builds {@link EntityReference}s from the entities with an
   * explicit {@code entityType}. Avoids the gotcha where {@code Entity.getEntityReference()}
   * may return a reference whose {@code type} field is null (the API doesn't always
   * populate it on the response), which makes the endpoint reject the body with
   * "type must not be null".
   */
  public void recreateAndAwait(
      final String entityType, final List<? extends EntityInterface> entities) {
    if (entities == null || entities.isEmpty()) {
      throw new IllegalArgumentException("entity list must not be empty");
    }
    final List<EntityReference> refs =
        entities.stream()
            .map(
                e ->
                    new EntityReference()
                        .withId(e.getId())
                        .withType(entityType)
                        .withFullyQualifiedName(e.getFullyQualifiedName()))
            .toList();
    recreateAndAwait(refs, DEFAULT_WAIT);
  }

  /**
   * Wait (without triggering anything) for the given entities to be present in their
   * alias. Useful as a pre-test gate so the "before" UI snapshot doesn't race the
   * live-index path that runs after entity creation.
   */
  public void awaitIndexed(
      final String entityType, final List<? extends EntityInterface> entities) {
    awaitIndexed(entityType, entities, DEFAULT_WAIT);
  }

  public void awaitIndexed(
      final String entityType,
      final List<? extends EntityInterface> entities,
      final Duration maxWait) {
    final List<EntityReference> refs =
        entities.stream()
            .map(
                e ->
                    new EntityReference()
                        .withId(e.getId())
                        .withType(entityType)
                        .withFullyQualifiedName(e.getFullyQualifiedName()))
            .toList();
    awaitAllPresent(refs, maxWait);
  }

  private void trigger(final List<EntityReference> refs) {
    // The endpoint returns a plain-text "Reindex process started for N..." message,
    // not JSON — use executeForString so the SDK doesn't try to parse it as JSON.
    server
        .sdk()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, "/v1/search/reindexEntities?recreate=true&timeoutMinutes=5", refs);
  }

  /**
   * For each entity, poll its alias until {@code id} matches one doc. Recreate
   * deletes then re-adds, so a doc may briefly be absent — we wait for it to
   * reappear rather than checking once.
   */
  private void awaitAllPresent(final List<EntityReference> refs, final Duration maxWait) {
    final Map<String, List<String>> byAlias =
        refs.stream()
            .collect(
                Collectors.groupingBy(
                    r -> inspector.aliasFor(r.getType()),
                    Collectors.mapping(r -> r.getId().toString(), Collectors.toList())));

    Awaitility.await("reindexEntities to land for " + refs.size() + " entities")
        .atMost(maxWait)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(
            () -> {
              for (final Map.Entry<String, List<String>> entry : byAlias.entrySet()) {
                final String alias = entry.getKey();
                for (final String id : entry.getValue()) {
                  if (!docExists(alias, id)) {
                    return false;
                  }
                }
              }
              return true;
            });
  }

  private boolean docExists(final String alias, final String id) {
    final String body = "{\"size\":0,\"query\":{\"term\":{\"id.keyword\":\"" + id + "\"}}}";
    final JsonNode response = search.post("/" + alias + "/_search", body);
    return response.path("hits").path("total").path("value").asLong() == 1;
  }
}
