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

/**
 * Streams a search response directly to the HTTP output instead of materializing it into a single
 * in-memory String.
 *
 * <p>The previous pattern built the entire response as one String before returning it
 * ({@code searchResponse.toJsonString()} on OpenSearch, {@code serializeSearchResponse(...)} on
 * ElasticSearch). For a single very large document — e.g. a container carrying a 170MB+ {@code
 * dataModel} — that String is hundreds of MB allocated in one shot, on top of the already-parsed
 * response object, and OOMs the node under concurrency. Writing the JSON straight to the response
 * {@link OutputStream} removes that second full-size copy of the payload.
 *
 * <p>The serialization itself is engine-specific (the OpenSearch and ElasticSearch client types are
 * distinct), so each manager supplies a {@link JsonWriter} that writes its typed response using its
 * own JSON-P mapper; this helper owns the shared JAX-RS streaming plumbing.
 *
 * <p><b>Error semantics.</b> A {@link StreamingOutput} commits the HTTP status and headers once the
 * first buffer flushes. If serialization fails after that point the status can no longer be changed,
 * so a mid-stream failure surfaces as a 200 with a truncated body rather than a clean 5xx. The
 * caller-side cache path mitigates this for the common case by serializing into a bounded buffer
 * <i>before</i> the response is committed (see {@link CapBufferingOutputStream}); only oversized
 * responses, which cannot be buffered, carry the inherent streaming trade-off.
 */
public final class SearchResponseStreamer {

  private SearchResponseStreamer() {}

  /** Writes a JSON payload to the supplied output stream. */
  @FunctionalInterface
  public interface JsonWriter {
    void writeTo(OutputStream output) throws IOException;
  }

  public static Response stream(JsonWriter writer) {
    StreamingOutput body = writer::writeTo;
    return Response.ok(body, MediaType.APPLICATION_JSON_TYPE).build();
  }
}
