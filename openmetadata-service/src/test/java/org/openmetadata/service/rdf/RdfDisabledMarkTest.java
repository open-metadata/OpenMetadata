package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

class RdfDisabledMarkTest {
  private final RdfLiveWriteStore store = mock(RdfLiveWriteStore.class);

  @Test
  void recordsWhenThereIsNoRdfConfiguration() {
    RdfDisabledMark.recordIfDisabled(null, store);

    verify(store).recordRdfDisabled();
  }

  @Test
  void recordsWhenEnabledIsNotSet() {
    RdfDisabledMark.recordIfDisabled(new RdfConfiguration(), store);

    verify(store).recordRdfDisabled();
  }

  @Test
  void recordsWhenRdfIsDisabled() {
    RdfDisabledMark.recordIfDisabled(new RdfConfiguration().withEnabled(false), store);

    verify(store).recordRdfDisabled();
  }

  @Test
  void recordsNothingWhenRdfIsEnabled() {
    RdfDisabledMark.recordIfDisabled(new RdfConfiguration().withEnabled(true), store);

    verify(store, never()).recordRdfDisabled();
  }

  @Test
  void aStoreFailureDoesNotFailStartup() {
    doThrow(new IllegalStateException("column missing")).when(store).recordRdfDisabled();

    assertDoesNotThrow(() -> RdfDisabledMark.recordIfDisabled(null, store));
  }
}
