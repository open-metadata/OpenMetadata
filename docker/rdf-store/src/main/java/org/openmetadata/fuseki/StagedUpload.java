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
package org.openmetadata.fuseki;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.jena.fuseki.servlets.HttpAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class StagedUpload implements AutoCloseable {
  private static final Logger LOG = LoggerFactory.getLogger(StagedUpload.class);
  private static final int MAX_CONCURRENT_UPLOADS = 16;
  private static final int BUFFER_BYTES = 64 * 1024;
  private static final Semaphore CAPACITY = new Semaphore(MAX_CONCURRENT_UPLOADS, true);
  private static final ExecutorService READERS =
      Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("rdf-upload-", 0).factory());

  private final Path path;
  private boolean closed;

  private StagedUpload(final Path path) {
    this.path = path;
  }

  static StagedUpload receive(
      final HttpAction action, final WriteDeadline deadline, final long maxBytes)
      throws IOException, InterruptedException, ExecutionException, TimeoutException {
    if (!CAPACITY.tryAcquire(deadline.remainingNanos(), TimeUnit.NANOSECONDS)) {
      throw new TimeoutException("Graph Store upload capacity exhausted");
    }
    final StagedUpload upload = create();
    final AtomicInteger readerState = new AtomicInteger();
    final Future<?> reader =
        READERS.submit(
            () -> {
              if (readerState.compareAndSet(0, 1)) {
                upload.copy(action, deadline, maxBytes);
              }
              return null;
            });
    try {
      reader.get(deadline.remainingNanos(), TimeUnit.NANOSECONDS);
      return upload;
    } catch (InterruptedException | ExecutionException | TimeoutException exception) {
      reader.cancel(true);
      if (readerState.compareAndSet(0, 2)) {
        CAPACITY.release();
      }
      upload.close();
      throw exception;
    }
  }

  private static StagedUpload create() throws IOException {
    try {
      return new StagedUpload(Files.createTempFile("rdf-upload-", ".rdf"));
    } catch (IOException exception) {
      CAPACITY.release();
      throw exception;
    }
  }

  private Void copy(final HttpAction action, final WriteDeadline deadline, final long maxBytes)
      throws IOException {
    try (InputStream input = action.getRequestInputStream();
        OutputStream output = openOutput()) {
      copyBounded(input, output, deadline, maxBytes);
    } finally {
      CAPACITY.release();
    }
    return null;
  }

  static void copyBounded(
      final InputStream input,
      final OutputStream output,
      final WriteDeadline deadline,
      final long maxBytes)
      throws IOException {
    final byte[] buffer = new byte[BUFFER_BYTES];
    long bytes = 0;
    int count;
    while ((count = input.read(buffer)) != -1) {
      deadline.check();
      bytes += count;
      if (bytes > maxBytes) {
        throw new TooLarge("Graph Store upload exceeds " + maxBytes + " decompressed bytes");
      }
      output.write(buffer, 0, count);
    }
    deadline.check();
  }

  Path path() {
    return path;
  }

  private synchronized OutputStream openOutput() throws IOException {
    if (closed) {
      throw new IOException("Upload has already expired");
    }
    return Files.newOutputStream(path);
  }

  @Override
  public synchronized void close() {
    closed = true;
    try {
      Files.deleteIfExists(path);
    } catch (IOException exception) {
      LOG.warn("Could not remove staged RDF upload {}", path, exception);
    }
  }

  static final class TooLarge extends IOException {
    TooLarge(final String message) {
      super(message);
    }
  }
}
