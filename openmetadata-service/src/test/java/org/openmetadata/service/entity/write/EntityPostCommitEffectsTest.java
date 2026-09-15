package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfTagUpdater;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityPostCommitEffectsTest {
  private final List<String> published = new ArrayList<>();
  private final DeferredCacheInvalidations cache =
      new DeferredCacheInvalidations((type, id, fqn) -> published.add("cache"));
  private final EntityPostCommitEffects effects = new EntityPostCommitEffects("table", cache);

  @AfterEach
  void clearCollectors() {
    cache.clear();
    RdfTagUpdater.clearDeferred();
    LineageUtil.clearLineageDeferred();
    SearchRepository.clearSearchWriteDeferred();
    PostCommitActionQueue.clear();
  }

  @Test
  void commitPublishesCacheBeforeSearchAndOtherActions() {
    var scope = effects.newScope();
    scope.reopenForAttempt();
    enqueue("committed");
    assertTrue(published.isEmpty());

    scope.finish(true);

    assertEquals(List.of("cache", "search:committed", "action:committed"), published);
    assertReleased();
  }

  @Test
  void retryDiscardsTheFailedAttempt() {
    var scope = effects.newScope();
    scope.reopenForAttempt();
    enqueue("failed");
    scope.reopenForAttempt();
    enqueue("committed");

    scope.finish(true);

    assertEquals(List.of("cache", "search:committed", "action:committed"), published);
    assertReleased();
  }

  @Test
  void nestedRetryRewindsOnlyItsOwnContributions() {
    var outer = effects.newScope();
    outer.reopenForAttempt();
    enqueue("outer");
    var inner = effects.newScope();
    inner.reopenForAttempt();
    enqueue("failed-inner");
    inner.reopenForAttempt();
    enqueue("inner");
    inner.finish(true);
    assertTrue(published.isEmpty());

    outer.finish(true);

    assertEquals(
        List.of(
            "cache",
            "cache",
            "cache",
            "search:outer",
            "search:inner",
            "action:outer",
            "action:inner"),
        published);
    assertReleased();
  }

  @Test
  void rollbackPublishesNothing() {
    var scope = effects.newScope();
    scope.reopenForAttempt();
    enqueue("failed");
    scope.finish(false);
    assertTrue(published.isEmpty());
    assertReleased();
  }

  @Test
  void cacheFailureDoesNotStrandLaterCollectors() {
    var failingCache =
        new DeferredCacheInvalidations(
            (type, id, fqn) -> {
              throw new IllegalStateException("Redis unavailable");
            });
    var scope = new EntityPostCommitEffects("table", failingCache).newScope();
    scope.reopenForAttempt();
    failingCache.deferOrRun("table", UUID.randomUUID(), "table");
    PostCommitActionQueue.runOrDefer(() -> published.add("action"));

    scope.finish(true);

    assertEquals(List.of("action"), published);
    assertTrue(failingCache.begin());
    failingCache.clear();
    assertReleased();
  }

  private void enqueue(String value) {
    cache.deferOrRun("table", UUID.randomUUID(), value);
    SearchRepository.deferOrRunSearchWrite(
        () -> published.add("search:" + value), "test", null, null, "table");
    PostCommitActionQueue.runOrDefer(() -> published.add("action:" + value));
  }

  private void assertReleased() {
    assertTrue(cache.begin());
    assertTrue(RdfTagUpdater.beginDeferral());
    assertTrue(LineageUtil.beginLineageDeferral());
    assertTrue(SearchRepository.beginSearchWriteDeferral());
    assertTrue(PostCommitActionQueue.begin());
  }
}
