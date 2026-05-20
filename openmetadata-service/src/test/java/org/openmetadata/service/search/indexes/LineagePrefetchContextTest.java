package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.EsLineageData;

class LineagePrefetchContextTest {

  @AfterEach
  void cleanThreadLocal() {
    LineagePrefetchContext.clear();
  }

  @Test
  void getReturnsNullWhenNotSet() {
    assertNull(LineagePrefetchContext.getUpstream());
  }

  @Test
  void setStoresValueAndGetReturnsSameInstance() {
    List<EsLineageData> edges = List.of(new EsLineageData());

    LineagePrefetchContext.setUpstream(edges);

    assertSame(edges, LineagePrefetchContext.getUpstream());
  }

  @Test
  void setEmptyListIsDistinguishedFromUnset() {
    LineagePrefetchContext.setUpstream(Collections.emptyList());

    List<EsLineageData> bound = LineagePrefetchContext.getUpstream();
    assertNotSame(null, bound);
    assertTrue(bound.isEmpty());
  }

  @Test
  void clearRemovesValue() {
    LineagePrefetchContext.setUpstream(List.of(new EsLineageData()));

    LineagePrefetchContext.clear();

    assertNull(LineagePrefetchContext.getUpstream());
  }

  @Test
  void clearIsSafeWhenNothingBound() {
    LineagePrefetchContext.clear();

    assertNull(LineagePrefetchContext.getUpstream());
  }

  @Test
  void valuesAreIsolatedAcrossThreads() throws Exception {
    LineagePrefetchContext.setUpstream(List.of(new EsLineageData()));
    AtomicReference<List<EsLineageData>> observed = new AtomicReference<>(List.of());

    Thread other =
        new Thread(
            () -> {
              try {
                observed.set(LineagePrefetchContext.getUpstream());
              } finally {
                LineagePrefetchContext.clear();
              }
            });
    other.start();
    other.join(5_000);
    if (other.isAlive()) {
      fail("worker thread did not finish in time");
    }

    assertNull(observed.get());
  }
}
