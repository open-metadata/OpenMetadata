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

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.rdf.RdfTagUpdater;
import org.openmetadata.service.search.DeferredSearchWrites;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Keeps external effects outside the SQL handle and discards effects from rolled-back attempts. */
@Slf4j
final class RepositorySideEffectScope {
  private boolean opened;
  private boolean ownsRdf;
  private boolean ownsLineage;
  private boolean ownsSearch;
  private boolean ownsCache;
  private boolean ownsPostCommit;
  private int rdfCheckpoint;
  private int lineageCheckpoint;
  private int searchCheckpoint;
  private int postCommitCheckpoint;

  void reopenForAttempt() {
    if (opened) {
      resetForReplay();
    } else {
      openCollectors();
      opened = true;
    }
  }

  private void openCollectors() {
    rdfCheckpoint = RdfTagUpdater.checkpoint();
    lineageCheckpoint = LineageUtil.checkpoint();
    searchCheckpoint = SearchRepository.searchWriteCheckpoint();
    postCommitCheckpoint = PostCommitActionQueue.checkpoint();
    ownsRdf = RdfTagUpdater.beginDeferral();
    ownsLineage = LineageUtil.beginLineageDeferral();
    ownsSearch = SearchRepository.beginSearchWriteDeferral();
    ownsCache = EntityRepository.beginCacheInvalidationDeferral();
    ownsPostCommit = PostCommitActionQueue.begin();
  }

  private void resetForReplay() {
    resetRdf();
    resetLineage();
    resetSearch();
    resetPostCommit();
    if (ownsCache) {
      EntityRepository.clearCacheInvalidations();
      EntityRepository.beginCacheInvalidationDeferral();
    }
  }

  private void resetRdf() {
    if (ownsRdf) {
      RdfTagUpdater.clearDeferred();
      RdfTagUpdater.beginDeferral();
    } else {
      RdfTagUpdater.rollbackToCheckpoint(rdfCheckpoint);
    }
  }

  private void resetLineage() {
    if (ownsLineage) {
      LineageUtil.clearLineageDeferred();
      LineageUtil.beginLineageDeferral();
    } else {
      LineageUtil.rollbackToCheckpoint(lineageCheckpoint);
    }
  }

  private void resetSearch() {
    if (ownsSearch) {
      SearchRepository.clearSearchWriteDeferred();
      SearchRepository.beginSearchWriteDeferral();
    } else {
      SearchRepository.rollbackSearchWriteToCheckpoint(searchCheckpoint);
    }
  }

  private void resetPostCommit() {
    if (ownsPostCommit) {
      PostCommitActionQueue.clear();
      PostCommitActionQueue.begin();
    } else {
      PostCommitActionQueue.rollbackToCheckpoint(postCommitCheckpoint);
    }
  }

  void finish(final boolean committed) {
    if (committed) {
      drain();
    } else {
      clear();
    }
  }

  private void drain() {
    // Detach every collector before any external call can fail or re-enter a repository.
    final List<Runnable> rdf = ownsRdf ? RdfTagUpdater.drainDeferredToList() : List.of();
    final List<LineageUtil.DeferredLineageEsWrite> lineage =
        ownsLineage ? LineageUtil.drainLineageDeferred() : List.of();
    final List<SearchRepository.DeferredSearchWrite> search =
        ownsSearch ? SearchRepository.drainSearchWriteDeferred() : List.of();
    final List<Runnable> actions = ownsPostCommit ? PostCommitActionQueue.drain() : List.of();
    if (ownsCache) {
      runGuarded(EntityRepository::drainCacheInvalidations);
    }
    runGuarded(() -> RdfTagUpdater.runDeferredClosures(rdf));
    runGuarded(() -> DeferredSearchWrites.runLineage(lineage));
    runGuarded(() -> DeferredSearchWrites.run(search));
    runGuarded(() -> PostCommitActionQueue.run(actions));
  }

  private void clear() {
    if (ownsRdf) {
      RdfTagUpdater.clearDeferred();
    }
    if (ownsLineage) {
      LineageUtil.clearLineageDeferred();
    }
    if (ownsSearch) {
      SearchRepository.clearSearchWriteDeferred();
    }
    if (ownsCache) {
      EntityRepository.clearCacheInvalidations();
    }
    if (ownsPostCommit) {
      PostCommitActionQueue.clear();
    }
  }

  private static void runGuarded(final Runnable drainStep) {
    try {
      drainStep.run();
    } catch (RuntimeException exception) {
      LOG.error("Post-commit deferral drain step failed", exception);
    }
  }
}
