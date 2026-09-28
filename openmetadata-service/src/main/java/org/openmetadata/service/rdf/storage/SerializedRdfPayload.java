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

import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.GZIPOutputStream;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.system.StreamRDF;
import org.apache.jena.riot.system.StreamRDFOps;
import org.apache.jena.riot.system.StreamRDFWriter;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Stages complete RDF before HTTP so a serialization failure cannot commit a valid prefix. */
final class SerializedRdfPayload implements AutoCloseable {
  private static final Logger LOG = LoggerFactory.getLogger(SerializedRdfPayload.class);
  private final Path path;
  private long bytes;

  private SerializedRdfPayload(final Path path) {
    this.path = path;
  }

  static SerializedRdfPayload prepare(
      final List<EntityWriteRequest> requests, final boolean gzip, final long maxBytes)
      throws IOException {
    final SerializedRdfPayload payload =
        new SerializedRdfPayload(Files.createTempFile("rdf-append-", ".rdf"));
    try {
      payload.serialize(requests, gzip, maxBytes);
      return payload;
    } catch (IOException | RuntimeException exception) {
      payload.close();
      throw exception;
    }
  }

  private void serialize(
      final List<EntityWriteRequest> requests, final boolean gzip, final long maxBytes)
      throws IOException {
    try (OutputStream raw = Files.newOutputStream(path);
        OutputStream encoded = gzip ? new GZIPOutputStream(raw, 64 * 1024) : raw;
        BoundedOutput output = new BoundedOutput(encoded, maxBytes)) {
      final StreamRDF writer = StreamRDFWriter.getWriterStream(output, Lang.RDFTHRIFT);
      writer.start();
      for (EntityWriteRequest request : requests) {
        StreamRDFOps.sendGraphToStream(request.model().getGraph(), writer);
      }
      writer.finish();
      bytes = output.bytes;
    }
  }

  Path path() {
    return path;
  }

  long bytes() {
    return bytes;
  }

  @Override
  public void close() {
    try {
      Files.deleteIfExists(path);
    } catch (IOException exception) {
      LOG.warn("Could not remove staged RDF payload {}", path, exception);
    }
  }

  private static final class BoundedOutput extends FilterOutputStream {
    private final long limit;
    private long bytes;

    private BoundedOutput(final OutputStream output, final long limit) {
      super(output);
      this.limit = limit;
    }

    private void reserve(final int count) {
      if (count > limit - bytes) {
        throw new RdfPayloadTooLargeException("RDF append exceeds " + limit + " serialized bytes");
      }
      if (Thread.currentThread().isInterrupted()) {
        throw new IllegalStateException("RDF serialization interrupted");
      }
      bytes += count;
    }

    @Override
    public void write(final int value) throws IOException {
      reserve(1);
      out.write(value);
    }

    @Override
    public void write(final byte[] data, final int offset, final int length) throws IOException {
      reserve(length);
      out.write(data, offset, length);
    }
  }
}
