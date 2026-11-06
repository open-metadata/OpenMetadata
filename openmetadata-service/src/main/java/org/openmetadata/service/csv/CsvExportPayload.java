/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.csv;

import jakarta.ws.rs.core.StreamingOutput;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Encodes a completed CSV export for storage in {@code background_jobs.result}.
 *
 * <p>The payload lives in the job row rather than on local disk so that any server can serve the
 * download: the node that ran the export is rarely the node the load balancer sends the download
 * request to. CSV compresses roughly tenfold, which keeps both the row and the peak heap during
 * encode/decode an order of magnitude below the raw export.
 *
 * <p>Because the column is character-typed, the gzip bytes are base64 encoded and tagged with
 * {@link #GZIP_PREFIX}. The tag also lets the download endpoint tell this format apart from the two
 * legacy ones it must still read: a {@code {"storage":"spool"}} pointer to a local file, and a
 * plain inline CSV from before spooling existed.
 */
public final class CsvExportPayload {
  static final String GZIP_PREFIX = "omcsv-gzip-v1:";

  /**
   * Ceiling on the stored (compressed) result. Base64 inflates by 4/3, so this leaves headroom
   * under MySQL's 64 MB default {@code max_allowed_packet}.
   */
  public static final int MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;

  private static final int INITIAL_BUFFER_BYTES = 64 * 1024;

  private CsvExportPayload() {}

  public static String compress(String csv) {
    final String encoded;
    try (Buffer buffer = new Buffer()) {
      buffer.stream().write(csv.getBytes(StandardCharsets.UTF_8));
      encoded = buffer.finish();
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to compress CSV export result", e);
    }
    return encoded;
  }

  public static boolean isCompressed(String storedResult) {
    return storedResult != null && storedResult.startsWith(GZIP_PREFIX);
  }

  /**
   * Copies {@code source} to the response and closes it. Download endpoints stream rather than
   * buffer, so the payload is never held in heap a second time on the way out.
   */
  public static StreamingOutput streamOf(IoSupplier<InputStream> source) {
    return output -> {
      try (InputStream in = source.get()) {
        in.transferTo(output);
      }
    };
  }

  @FunctionalInterface
  public interface IoSupplier<T> {
    T get() throws IOException;
  }

  public static InputStream decompress(String storedResult) {
    final InputStream decoded =
        Base64.getDecoder().wrap(new ByteArrayInputStream(base64Region(storedResult)));
    final InputStream csv;
    try {
      csv = new GZIPInputStream(decoded);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read compressed CSV export result", e);
    }
    return csv;
  }

  /**
   * Copies the base64 region out as bytes without {@code substring}, which would duplicate a
   * payload that can reach tens of megabytes. Base64 is ASCII, so the narrowing cast is lossless.
   */
  private static byte[] base64Region(String storedResult) {
    final byte[] bytes = new byte[storedResult.length() - GZIP_PREFIX.length()];
    for (int i = 0; i < bytes.length; i++) {
      bytes[i] = (byte) storedResult.charAt(GZIP_PREFIX.length() + i);
    }
    return bytes;
  }

  /**
   * Gzips CSV as it is written and aborts once the compressed payload would no longer fit the job
   * row. Failing mid-stream keeps a runaway export from buffering hundreds of megabytes before the
   * database rejects the write.
   */
  public static final class Buffer implements Closeable {
    private final ByteArrayOutputStream sink = new ByteArrayOutputStream(INITIAL_BUFFER_BYTES);
    private final GZIPOutputStream gzip;
    private final OutputStream guarded;
    private boolean finished;

    public Buffer() throws IOException {
      gzip = new GZIPOutputStream(sink);
      guarded = new SizeGuard(gzip, sink);
    }

    public OutputStream stream() {
      return guarded;
    }

    public String finish() throws IOException {
      if (!finished) {
        gzip.finish();
        finished = true;
      }
      return GZIP_PREFIX + Base64.getEncoder().encodeToString(sink.toByteArray());
    }

    @Override
    public void close() throws IOException {
      gzip.close();
    }
  }

  /** Trips as soon as the compressed byte count passes {@link #MAX_COMPRESSED_BYTES}. */
  private static final class SizeGuard extends FilterOutputStream {
    private final ByteArrayOutputStream compressed;

    private SizeGuard(OutputStream delegate, ByteArrayOutputStream compressed) {
      super(delegate);
      this.compressed = compressed;
    }

    @Override
    public void write(int b) throws IOException {
      out.write(b);
      checkSize();
    }

    @Override
    public void write(byte[] buffer, int offset, int length) throws IOException {
      out.write(buffer, offset, length);
      checkSize();
    }

    private void checkSize() {
      if (compressed.size() > MAX_COMPRESSED_BYTES) {
        throw new CsvExportTooLargeException(MAX_COMPRESSED_BYTES);
      }
    }
  }
}
