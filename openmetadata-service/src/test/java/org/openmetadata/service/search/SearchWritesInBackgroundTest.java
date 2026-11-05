package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SearchWritesInBackgroundTest {

  @AfterEach
  void closeScope() {
    SearchRepository.clearSearchWriteDeferred();
  }

  @Test
  void aCapturedRewriteRunsOffTheCallingThreadAfterTheWorkReturns() throws Exception {
    CountDownLatch workReturned = new CountDownLatch(1);
    CompletableFuture<Thread> writer = new CompletableFuture<>();

    String result =
        SearchRepository.withSearchWritesInBackground(
            "test",
            () -> {
              SearchRepository.deferOrRunSearchWrite(
                  () -> {
                    awaitQuietly(workReturned);
                    writer.complete(Thread.currentThread());
                  },
                  "rename",
                  null,
                  "glossary.term",
                  "glossaryTerm");
              return "applied";
            });
    workReturned.countDown();

    assertEquals("applied", result);
    assertNotSame(Thread.currentThread(), writer.get(30, TimeUnit.SECONDS));
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
  }

  @Test
  void aRewriteOfWorkThatFailsNeverRuns() {
    AtomicBoolean ran = new AtomicBoolean();

    assertThrows(
        IllegalStateException.class,
        () ->
            SearchRepository.withSearchWritesInBackground(
                "test",
                () -> {
                  SearchRepository.deferOrRunSearchWrite(
                      () -> ran.set(true), "rename", null, "glossary.term", "glossaryTerm");
                  throw new IllegalStateException("rolled back");
                }));

    assertFalse(ran.get());
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
  }

  @Test
  void underAnOpenScopeTheRewriteIsLeftForTheOuterOwner() {
    AtomicBoolean ran = new AtomicBoolean();
    assertTrue(SearchRepository.beginSearchWriteDeferral());

    SearchRepository.withSearchWritesInBackground(
        "test",
        () -> {
          SearchRepository.deferOrRunSearchWrite(
              () -> ran.set(true), "rename", null, "glossary.term", "glossaryTerm");
          return null;
        });

    List<SearchRepository.DeferredSearchWrite> captured =
        SearchRepository.drainSearchWriteDeferred();
    assertEquals(1, captured.size());
    assertFalse(ran.get());
  }

  private static void awaitQuietly(CountDownLatch latch) {
    try {
      latch.await(30, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
