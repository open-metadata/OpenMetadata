/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;

/**
 * Returns a search response either as a buffered String (the common case) or as a stream (the
 * oversized case), so a very large document can no longer OOM the node.
 *
 * <p>The previous pattern built the entire response as one String before returning it
 * ({@code serializeSearchResponse}/{@code toJsonString}). For a single very large document — e.g. a
 * container carrying a 170MB+ {@code dataModel} — that String is hundreds of MB allocated in one
 * shot, on top of the already-parsed response object, and OOMs the node under concurrency.
 *
 * <p>{@link #bufferOrStream} serializes into a {@link CapBufferingOutputStream} first: a normal
 * response (under {@link #MAX_BUFFERED_RESPONSE_BYTES}) is returned as a String, so the HTTP status
 * still reflects a serialization failure (a clean 5xx with a {@code Content-Length}) and the body is
 * cacheable. Only a response that exceeds the cap streams — there the intermediate String is exactly
 * the allocation that OOMs, so it is avoided. Streaming carries an inherent trade-off: the status
 * and headers are committed before the body is written, so a mid-stream failure yields a {@code 200}
 * with a truncated body rather than a clean 5xx. This is bounded to oversized responses, and the
 * truncation is still detectable by clients (the JSON is left incomplete/unparseable). Each manager
 * supplies a {@link JsonWriter} that serializes its engine-specific typed response.
 */
public final class SearchResponseStreamer {

  /**
   * Responses up to this size are buffered and returned as a String (clean error semantics);
   * larger ones stream. Well above any normal search response — only a pathologically large single
   * document (e.g. a 170MB {@code dataModel}) crosses it.
   */
  public static final int MAX_BUFFERED_RESPONSE_BYTES = 4 * 1024 * 1024;

  private SearchResponseStreamer() {}

  /** Writes a JSON payload to the supplied output stream. */
  @FunctionalInterface
  public interface JsonWriter {
    void writeTo(OutputStream output) throws IOException;
  }

  /**
   * Buffers the response into a bounded buffer and returns it as a String, falling back to streaming
   * only when the payload exceeds {@link #MAX_BUFFERED_RESPONSE_BYTES}. A genuine serialization
   * failure (not a cap overflow) propagates before any bytes are committed, preserving clean 5xx
   * semantics for the common case.
   */
  public static Response bufferOrStream(JsonWriter writer) {
    CapBufferingOutputStream buffer = new CapBufferingOutputStream(MAX_BUFFERED_RESPONSE_BYTES);
    Response response;
    try {
      writer.writeTo(buffer);
      response = Response.ok(buffer.toUtf8String(), MediaType.APPLICATION_JSON_TYPE).build();
    } catch (RuntimeException | IOException error) {
      response = onBufferFailure(error, writer);
    }
    return response;
  }

  /** Streams a JSON payload straight to the HTTP output, with no intermediate full-size String. */
  public static Response stream(JsonWriter writer) {
    StreamingOutput body = writer::writeTo;
    return Response.ok(body, MediaType.APPLICATION_JSON_TYPE).build();
  }

  private static Response onBufferFailure(Throwable error, JsonWriter writer) {
    if (!isOverCapacity(error)) {
      throw asUnchecked(error);
    }
    // Too large to buffer — stream it instead. The JSON-P generator may flush an incomplete
    // prefix into the discarded buffer; the stream below re-serializes from the in-memory response.
    return stream(writer);
  }

  private static boolean isOverCapacity(Throwable error) {
    // The JSON-P generator wraps an OutputStream IOException in an unchecked JsonException, so the
    // cap signal can arrive either directly or as a cause.
    Throwable cause = error;
    while (cause != null && !(cause instanceof CapBufferingOutputStream.OverCapacityException)) {
      cause = cause.getCause();
    }
    return cause != null;
  }

  private static RuntimeException asUnchecked(Throwable error) {
    return error instanceof RuntimeException runtime
        ? runtime
        : new UncheckedIOException("Failed to serialize search response", (IOException) error);
  }
}
