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

package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.inference.InferenceDirtyMarker;

class InferenceInvalidatingRdfStorageTest {
  private static final String UPDATE = "INSERT DATA { <urn:s> <urn:p> <urn:o> }";

  @Test
  void marksRulesDirtyAfterSuccessfulMutation() {
    final RdfStorageInterface delegate = mock(RdfStorageInterface.class);
    final InferenceDirtyMarker dirtyMarker = mock(InferenceDirtyMarker.class);

    new InferenceInvalidatingRdfStorage(delegate, dirtyMarker).executeSparqlUpdate(UPDATE);

    verify(delegate).executeSparqlUpdate(UPDATE);
    verify(dirtyMarker).markAllDirty();
  }

  @Test
  void anEntityWriteThatChangedNothingLeavesRulesClean() {
    final RdfStorageInterface delegate = mock(RdfStorageInterface.class);
    final InferenceDirtyMarker dirtyMarker = mock(InferenceDirtyMarker.class);
    final InferenceInvalidatingRdfStorage storage =
        new InferenceInvalidatingRdfStorage(delegate, dirtyMarker);
    final UUID id = UUID.randomUUID();
    final Model model = ModelFactory.createDefaultModel();
    when(delegate.storeEntity("table", id, model, RdfEntityWriteStrategy.DIFFERENCE))
        .thenReturn(RdfEntityWriteResult.UNCHANGED)
        .thenReturn(RdfEntityWriteResult.changedTriples(1, 1));

    assertEquals(RdfEntityWriteResult.UNCHANGED, storage.storeEntity("table", id, model));
    verify(dirtyMarker, never()).markAllDirty();

    storage.storeEntity("table", id, model);
    verify(dirtyMarker).markAllDirty();
  }

  @Test
  void anEntityWriteThatFailedMayHaveChangedTheGraphSoRulesAreDirty() {
    final RdfStorageInterface delegate = mock(RdfStorageInterface.class);
    final InferenceDirtyMarker dirtyMarker = mock(InferenceDirtyMarker.class);
    final UUID id = UUID.randomUUID();
    final Model model = ModelFactory.createDefaultModel();
    when(delegate.storeEntity("table", id, model, RdfEntityWriteStrategy.DIFFERENCE))
        .thenThrow(new IllegalStateException("read-back timed out after the update committed"))
        .thenReturn(RdfEntityWriteResult.UNCHANGED);
    final InferenceInvalidatingRdfStorage storage =
        new InferenceInvalidatingRdfStorage(delegate, dirtyMarker);

    assertThrows(IllegalStateException.class, () -> storage.storeEntity("table", id, model));
    assertEquals(RdfEntityWriteResult.UNCHANGED, storage.storeEntity("table", id, model));

    verify(dirtyMarker).markAllDirty();
  }

  @Test
  void leavesDirtyStateUntouchedWhenMutationFails() {
    final RdfStorageInterface delegate = mock(RdfStorageInterface.class);
    final InferenceDirtyMarker dirtyMarker = mock(InferenceDirtyMarker.class);
    doThrow(new IllegalStateException("Fuseki unavailable"))
        .when(delegate)
        .executeSparqlUpdate(UPDATE);

    assertThrows(
        IllegalStateException.class,
        () ->
            new InferenceInvalidatingRdfStorage(delegate, dirtyMarker).executeSparqlUpdate(UPDATE));

    verify(dirtyMarker, never()).markAllDirty();
  }
}
