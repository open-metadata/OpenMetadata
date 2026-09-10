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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;

class SerializedRdfPayloadTest {
  @Test
  void serializedByteLimitIncludesLongUnicodeLiteralsEvenWhenCompressed() throws Exception {
    final Model model = model("界".repeat(20_000));
    try {
      for (boolean gzip : List.of(false, true)) {
        assertThrows(
            RdfPayloadTooLargeException.class,
            () -> SerializedRdfPayload.prepare(List.of(request(model)), gzip, 1024));
      }
    } finally {
      model.close();
    }
  }

  @Test
  void completePayloadRoundTripsAndTemporaryFileIsRemoved() throws Exception {
    final Model original = model("界".repeat(20_000));
    final Model restored = ModelFactory.createDefaultModel();
    Path staged;
    try (SerializedRdfPayload payload =
        SerializedRdfPayload.prepare(List.of(request(original)), true, 100_000)) {
      staged = payload.path();
      assertTrue(payload.bytes() > Files.size(staged));
      try (InputStream input = new GZIPInputStream(Files.newInputStream(staged))) {
        RDFDataMgr.read(restored, input, Lang.RDFTHRIFT);
      }
      assertTrue(original.isIsomorphicWith(restored));
    } finally {
      original.close();
      restored.close();
    }
    assertFalse(Files.exists(staged));
  }

  @Test
  void limitAtTheExactSerializedLengthIsAccepted() throws Exception {
    final Model model = model("orders");
    try (SerializedRdfPayload first =
        SerializedRdfPayload.prepare(List.of(request(model)), false, 1024)) {
      try (SerializedRdfPayload exact =
          SerializedRdfPayload.prepare(List.of(request(model)), false, first.bytes())) {
        assertEquals(first.bytes(), exact.bytes());
      }
      assertThrows(
          RdfPayloadTooLargeException.class,
          () -> SerializedRdfPayload.prepare(List.of(request(model)), false, first.bytes() - 1));
    } finally {
      model.close();
    }
  }

  private static Model model(final String name) {
    final Model model = ModelFactory.createDefaultModel();
    model
        .createResource("urn:entity")
        .addProperty(model.createProperty("urn:name"), name)
        .addProperty(
            model.createProperty("urn:child"),
            model.createResource().addProperty(model.createProperty("urn:value"), "child"));
    return model;
  }

  private static EntityWriteRequest request(final Model model) {
    return new EntityWriteRequest("table", UUID.randomUUID(), model);
  }
}
