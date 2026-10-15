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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.PostCommitActionQueue;

class RepositorySideEffectScopeTest {

  @Test
  void replayKeepsAnEnclosingCollectorsEarlierEffects() {
    final List<String> published = new ArrayList<>();
    final RepositorySideEffectScope outer = new RepositorySideEffectScope();
    final RepositorySideEffectScope inner = new RepositorySideEffectScope();
    outer.reopenForAttempt();
    try {
      deferEffects(published, "outer");
      inner.reopenForAttempt();
      deferEffects(published, "discarded attempt");
      inner.reopenForAttempt();
      deferEffects(published, "committed attempt");
      inner.finish(true);
      assertEquals(List.of(), published, "Only the enclosing collector may publish");
      outer.finish(true);
      assertEquals(
          List.of(
              "search outer",
              "search committed attempt",
              "action outer",
              "action committed attempt"),
          published);
    } finally {
      outer.finish(false);
    }
  }

  @Test
  void failedInnerScopeDoesNotCloseItsEnclosingCollector() {
    final List<String> published = new ArrayList<>();
    final RepositorySideEffectScope outer = new RepositorySideEffectScope();
    final RepositorySideEffectScope inner = new RepositorySideEffectScope();
    outer.reopenForAttempt();
    try {
      deferEffects(published, "outer");
      inner.reopenForAttempt();
      inner.finish(false);
      assertTrue(SearchRepository.isSearchWriteDeferralActive());
      outer.finish(true);
      assertEquals(List.of("search outer", "action outer"), published);
    } finally {
      outer.finish(false);
    }
  }

  @Test
  void aFailedSearchDeliveryDoesNotSuppressOtherEffectsOrTheNextRequest() {
    final List<String> published = new ArrayList<>();
    final RepositorySideEffectScope scope = new RepositorySideEffectScope();
    scope.reopenForAttempt();
    try {
      deferSearch(
          () -> {
            throw new IllegalStateException("search unavailable");
          });
      deferEffects(published, "committed");
      scope.finish(true);
      assertFalse(SearchRepository.isSearchWriteDeferralActive());
      deferEffects(published, "next request");
      assertEquals(
          List.of(
              "search committed", "action committed", "search next request", "action next request"),
          published);
    } finally {
      scope.finish(false);
    }
  }

  private static void deferEffects(final List<String> published, final String value) {
    deferSearch(() -> published.add("search " + value));
    PostCommitActionQueue.runOrDefer(() -> published.add("action " + value));
  }

  private static void deferSearch(final Runnable effect) {
    SearchRepository.runAfterCommit(effect, "test", null);
  }
}
