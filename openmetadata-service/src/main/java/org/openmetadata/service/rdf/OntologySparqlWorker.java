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

package org.openmetadata.service.rdf;

import com.google.common.base.Utf8;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.QueryCancelledException;
import org.apache.jena.query.QueryDeniedException;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.riot.RDFParser;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryCapacityException;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryTimeoutException;
import org.openmetadata.service.rdf.SparqlQueryLimits.BoundedOutputStream;
import org.openmetadata.service.rdf.SparqlQueryLimits.OntologyTooLargeException;
import org.openmetadata.service.rdf.SparqlQueryLimits.QueryLimitExceededException;

@Slf4j
final class OntologySparqlWorker implements AutoCloseable {
  private static final Semaphore PERMIT = new Semaphore(1, true);
  private static final long MAX_ADMISSION_WAIT_NANOS = TimeUnit.SECONDS.toNanos(5);
  private static final int MAX_INPUT_BYTES = 32 * 1024 * 1024;
  private static final int BASE_HEAP_MIB = 64;
  private static final int MAX_HEAP_MIB = 256;
  private static final int HEAP_BYTES_PER_INPUT_BYTE = 24;
  private static final int MEBIBYTE = 1024 * 1024;
  private static final int MAX_QUERY_BYTES = 4 * SparqlQueryLimits.MAX_QUERY_CHARACTERS;
  private static final int MAX_STATUS_BYTES = 4096;
  private static final int MAX_DETAIL_CHARACTERS = 1000;
  private static final int HOTSPOT_OUT_OF_MEMORY_EXIT = 3;
  private static final String INPUT = "request";
  private static final String OUTPUT = "result";
  private static final String STATUS = "status";
  private static final String LOADING_ONTOLOGY = "loading-ontology";
  private static final String INPUT_LIMIT_MESSAGE =
      "SPARQL ontology exceeds the maximum input size of 32 MiB";
  static final String OUTPUT_LIMIT_MESSAGE =
      "SPARQL result exceeds the maximum response size of %,d bytes"
          .formatted(SparqlQueryLimits.MAX_OUTPUT_BYTES);

  private final int timeoutMillis;
  private final long deadlineNanos;
  private Path directory;
  private Process process;
  private boolean closed;

  private OntologySparqlWorker(final int timeoutMillis) {
    this.timeoutMillis = timeoutMillis;
    deadlineNanos = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
  }

  static OntologySparqlWorker acquire(final int timeoutMillis) {
    final OntologySparqlWorker worker = new OntologySparqlWorker(timeoutMillis);
    worker.awaitPermit();
    try {
      worker.requireTimeRemaining();
    } catch (final QueryTimeoutException exception) {
      worker.close();
      throw exception;
    }
    return worker;
  }

  private void awaitPermit() {
    try {
      final long waitNanos = Math.min(requireTimeRemaining(), MAX_ADMISSION_WAIT_NANOS);
      if (!PERMIT.tryAcquire(waitNanos, TimeUnit.NANOSECONDS)) {
        requireTimeRemaining();
        throw new QueryCapacityException("SPARQL ontology worker concurrency limit reached");
      }
    } catch (final InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new QueryTimeoutException(timeoutMillis, exception);
    }
  }

  String execute(final Model model, final SparqlQuery request) {
    try {
      requireTimeRemaining();
      createFiles();
      writeInput(model, request);
      requireTimeRemaining();
      process = processBuilder().start();
      awaitExit();
      return readResult();
    } catch (final IOException exception) {
      throw new IllegalStateException("SPARQL worker transport failed", exception);
    } finally {
      stopAndReap();
    }
  }

  private void createFiles() throws IOException {
    directory =
        Files.createTempDirectory(
            "ontology-sparql-",
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
    for (final String name : new String[] {INPUT, OUTPUT, STATUS}) {
      Files.createFile(
          directory.resolve(name),
          PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    }
  }

  /** Any input refusal is the ontology's size: query text is bounded long before this point. */
  private void writeInput(final Model model, final SparqlQuery request) throws IOException {
    try {
      writeBoundedInput(model, request);
    } catch (final QueryLimitExceededException exception) {
      throw new OntologyTooLargeException(exception.getMessage());
    }
  }

  private void writeBoundedInput(final Model model, final SparqlQuery request) throws IOException {
    try (final DataOutputStream output =
        new DataOutputStream(
            new BufferedOutputStream(
                new BoundedOutputStream(
                    new DeadlineOutputStream(Files.newOutputStream(directory.resolve(INPUT))),
                    MAX_INPUT_BYTES,
                    INPUT_LIMIT_MESSAGE)))) {
      final byte[] query = request.getQuery().getBytes(StandardCharsets.UTF_8);
      output.writeInt(query.length);
      output.write(query);
      output.writeUTF(request.getFormat() == null ? "" : request.getFormat().name());
      output.writeUTF(request.getInference() == null ? "" : request.getInference().name());
      output.writeInt(timeoutMillis);
      writePrefixes(output, model);
      RDFDataMgr.write(output, model, RDFFormat.NTRIPLES_UTF8);
    }
  }

  private static void writePrefixes(final DataOutputStream output, final Model model)
      throws IOException {
    final var prefixes = model.getNsPrefixMap();
    output.writeInt(prefixes.size());
    for (final var prefix : prefixes.entrySet()) {
      writePrefixText(output, prefix.getKey());
      writePrefixText(output, prefix.getValue());
    }
  }

  private static void writePrefixText(final DataOutputStream output, final String value)
      throws IOException {
    if (value.length() > MAX_INPUT_BYTES || Utf8.encodedLength(value) > MAX_INPUT_BYTES) {
      throw new QueryLimitExceededException(INPUT_LIMIT_MESSAGE);
    }
    final byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
    output.writeInt(bytes.length);
    output.write(bytes);
  }

  private ProcessBuilder processBuilder() throws IOException {
    final long heapMib =
        Math.min(
            MAX_HEAP_MIB,
            BASE_HEAP_MIB
                + (Files.size(directory.resolve(INPUT)) * HEAP_BYTES_PER_INPUT_BYTE + MEBIBYTE - 1)
                    / MEBIBYTE);
    final ProcessBuilder builder =
        new ProcessBuilder(
            Path.of(System.getProperty("java.home"), "bin", "java").toString(),
            "-Xms16m",
            "-Xmx" + heapMib + "m",
            "-Xss512k",
            "-XX:MaxMetaspaceSize=64m",
            "-XX:MaxDirectMemorySize=16m",
            "-XX:ReservedCodeCacheSize=32m",
            "-XX:+UseSerialGC",
            "-XX:ActiveProcessorCount=1",
            "-XX:+ExitOnOutOfMemoryError",
            "-cp",
            System.getProperty("java.class.path"),
            OntologySparqlQueryService.Worker.class.getName(),
            directory.toString());
    builder.environment().clear();
    builder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
    builder.redirectError(ProcessBuilder.Redirect.DISCARD);
    return builder;
  }

  private void awaitExit() {
    try {
      if (!process.waitFor(requireTimeRemaining(), TimeUnit.NANOSECONDS)) {
        throw new QueryTimeoutException(timeoutMillis, null);
      }
    } catch (final InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new QueryTimeoutException(timeoutMillis, exception);
    }
    if (process.exitValue() == HOTSPOT_OUT_OF_MEMORY_EXIT) {
      throw memoryLimitFailure(directory);
    }
    if (process.exitValue() != 0) {
      throw new IllegalStateException(
          "SPARQL worker exited unexpectedly with code " + process.exitValue());
    }
  }

  static QueryLimitExceededException memoryLimitFailure(final Path directory) {
    return Files.exists(directory.resolve(LOADING_ONTOLOGY))
        ? new OntologyTooLargeException(
            "SPARQL ontology is too large for the worker memory budget while loading")
        : new QueryLimitExceededException(
            "SPARQL query or inference exceeds the execution memory budget");
  }

  private String readResult() throws IOException {
    requireTimeRemaining();
    try (final DataInputStream status =
        new DataInputStream(
            new ByteArrayInputStream(
                readBoundedFile(directory.resolve(STATUS), MAX_STATUS_BYTES)))) {
      final int kind = status.readUnsignedByte();
      final String detail = status.readUTF();
      if (kind >= Status.values().length || status.read() != -1) {
        throw new IOException("Invalid SPARQL worker status");
      }
      requireSuccess(Status.values()[kind], detail);
    }
    return new String(
        readBoundedFile(directory.resolve(OUTPUT), SparqlQueryLimits.MAX_OUTPUT_BYTES),
        StandardCharsets.UTF_8);
  }

  private void requireSuccess(final Status status, final String detail) throws IOException {
    switch (status) {
      case SUCCESS -> {
        if (!detail.isEmpty()) {
          throw new IOException("Invalid successful SPARQL worker status");
        }
      }
      case LIMIT -> throw new QueryLimitExceededException(detail);
      case UNSUPPORTED_FORMAT -> throw new UnsupportedRdfSerializationException(detail);
      case INVALID_QUERY -> throw new IllegalArgumentException(detail);
      case DENIED_QUERY -> throw new QueryDeniedException(detail);
      case TIMEOUT -> throw new QueryTimeoutException(timeoutMillis, null);
      case FAILURE -> throw new IllegalStateException("SPARQL worker failed: " + detail);
    }
  }

  private static byte[] readBoundedFile(final Path path, final int maximumBytes)
      throws IOException {
    final long length = Files.size(path);
    if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || length > maximumBytes) {
      throw new IOException("Invalid SPARQL worker file size");
    }
    try (final var input = Files.newInputStream(path)) {
      final byte[] bytes = input.readNBytes((int) length);
      if (bytes.length != length || input.read() != -1) {
        throw new IOException("Incomplete SPARQL worker file");
      }
      return bytes;
    }
  }

  private long requireTimeRemaining() {
    final long remaining = deadlineNanos - System.nanoTime();
    if (remaining <= 0 || Thread.currentThread().isInterrupted()) {
      throw new QueryTimeoutException(timeoutMillis, null);
    }
    return remaining;
  }

  private void stopAndReap() {
    if (process == null) {
      return;
    }
    if (process.isAlive()) {
      process.destroyForcibly();
    }
    boolean interrupted = false;
    while (true) {
      try {
        process.waitFor();
        break;
      } catch (final InterruptedException exception) {
        interrupted = true;
      }
    }
    if (interrupted) {
      Thread.currentThread().interrupt();
    }
  }

  @Override
  public void close() {
    if (!closed) {
      stopAndReap();
      cleanupFiles();
      closed = true;
      PERMIT.release();
    }
  }

  private void cleanupFiles() {
    if (directory == null) {
      return;
    }
    for (final String name : new String[] {INPUT, OUTPUT, STATUS, LOADING_ONTOLOGY, ""}) {
      try {
        Files.deleteIfExists(directory.resolve(name));
      } catch (final IOException exception) {
        LOG.warn(
            "Could not remove SPARQL worker temporary file {}", directory.resolve(name), exception);
      }
    }
  }

  static DataInputStream openInput(final Path directory) throws IOException {
    final Path input = directory.resolve(INPUT);
    if (Files.size(input) > MAX_INPUT_BYTES) {
      throw new IOException("Invalid SPARQL worker input size");
    }
    return new DataInputStream(new BufferedInputStream(Files.newInputStream(input)));
  }

  static OutputStream openOutput(final Path directory) throws IOException {
    return new BoundedOutputStream(
        new BufferedOutputStream(Files.newOutputStream(directory.resolve(OUTPUT))),
        SparqlQueryLimits.MAX_OUTPUT_BYTES,
        OUTPUT_LIMIT_MESSAGE);
  }

  static void readModel(final Path directory, final DataInputStream input, final Model model)
      throws IOException {
    final Path loading = directory.resolve(LOADING_ONTOLOGY);
    // The marker survives ExitOnOutOfMemoryError, which bypasses exception handlers.
    Files.createFile(
        loading,
        PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    readPrefixes(input, model);
    RDFParser.create().source(input).lang(Lang.NTRIPLES).parse(model);
    Files.delete(loading);
  }

  private static void readPrefixes(final DataInputStream input, final Model model)
      throws IOException {
    final int count = input.readInt();
    if (count < 0 || count > MAX_INPUT_BYTES / (2 * Integer.BYTES)) {
      throw new IOException("Invalid SPARQL worker prefix count");
    }
    for (int index = 0; index < count; index++) {
      model.setNsPrefix(readPrefixText(input), readPrefixText(input));
    }
  }

  private static String readPrefixText(final DataInputStream input) throws IOException {
    final int length = input.readInt();
    if (length < 0 || length > MAX_INPUT_BYTES) {
      throw new IOException("Invalid SPARQL worker prefix size");
    }
    final byte[] bytes = input.readNBytes(length);
    if (bytes.length != length) {
      throw new IOException("Incomplete SPARQL worker prefix");
    }
    return new String(bytes, StandardCharsets.UTF_8);
  }

  static SparqlQuery readRequest(final DataInputStream input) throws IOException {
    final int length = input.readInt();
    if (length < 0 || length > MAX_QUERY_BYTES) {
      throw new IOException("Invalid SPARQL worker query size");
    }
    final byte[] query = input.readNBytes(length);
    if (query.length != length) {
      throw new IOException("Incomplete SPARQL worker query");
    }
    final String format = input.readUTF();
    final String inference = input.readUTF();
    return new SparqlQuery()
        .withQuery(new String(query, StandardCharsets.UTF_8))
        .withFormat(format.isEmpty() ? null : SparqlQuery.Format.valueOf(format))
        .withInference(inference.isEmpty() ? null : SparqlQuery.Inference.valueOf(inference))
        .withTimeout(input.readInt());
  }

  static void writeStatus(final Path directory, final Status status, final String detail)
      throws IOException {
    final String boundedDetail =
        detail == null ? "" : detail.substring(0, Math.min(detail.length(), MAX_DETAIL_CHARACTERS));
    try (final DataOutputStream output =
        new DataOutputStream(
            new BoundedOutputStream(
                Files.newOutputStream(directory.resolve(STATUS)),
                MAX_STATUS_BYTES,
                "SPARQL worker status exceeds its size limit"))) {
      output.writeByte(status.ordinal());
      output.writeUTF(boundedDetail);
    }
  }

  static void writeFailure(final Path directory, final RuntimeException failure)
      throws IOException {
    Throwable cause = failure;
    for (int depth = 0; cause != null && depth < 16; depth++, cause = cause.getCause()) {
      if (cause instanceof QueryLimitExceededException) {
        writeStatus(directory, Status.LIMIT, cause.getMessage());
        return;
      }
      if (cause instanceof QueryCancelledException) {
        writeStatus(directory, Status.TIMEOUT, "");
        return;
      }
      if (cause instanceof QueryDeniedException) {
        writeStatus(directory, Status.DENIED_QUERY, cause.getMessage());
        return;
      }
    }
    final Status status =
        failure instanceof UnsupportedRdfSerializationException
            ? Status.UNSUPPORTED_FORMAT
            : failure instanceof IllegalArgumentException ? Status.INVALID_QUERY : Status.FAILURE;
    writeStatus(directory, status, failure.getMessage());
  }

  enum Status {
    SUCCESS,
    LIMIT,
    UNSUPPORTED_FORMAT,
    INVALID_QUERY,
    DENIED_QUERY,
    TIMEOUT,
    FAILURE
  }

  private final class DeadlineOutputStream extends FilterOutputStream {
    private DeadlineOutputStream(final OutputStream output) {
      super(output);
    }

    @Override
    public void write(final int value) throws IOException {
      requireTimeRemaining();
      out.write(value);
    }

    @Override
    public void write(final byte[] bytes, final int offset, final int length) throws IOException {
      requireTimeRemaining();
      out.write(bytes, offset, length);
    }
  }
}
