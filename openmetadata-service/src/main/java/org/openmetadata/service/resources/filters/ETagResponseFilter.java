/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.util.EntityETag;

/**
 * JAX-RS filter that adds an {@code ETag} header to entity GET responses and to successful
 * mutation responses (PUT/POST/PATCH), and short-circuits GETs to {@code 304 Not Modified} when
 * the client's {@code If-None-Match} matches the computed ETag. Emitting the ETag on mutation
 * responses lets a client issue a follow-up conditional write ({@code If-Match}) without an
 * intervening GET, which is the basis for optimistic-concurrency-safe edit chains.
 *
 * <p>The 304 path saves the response body bytes on the wire and the client-side render cost on
 * revisits — the server still computes the entity body (we'd need a cheap version-stamp lookup
 * to truly skip the work, see design doc), but the network and client savings are immediate.
 *
 * <p>{@code Cache-Control: no-store} is emitted alongside the ETag. Without an explicit
 * Cache-Control, Chrome falls back to heuristic caching for ETag-bearing responses and reuses
 * the cached body on a 304. That breaks any mutation path where the server returns 304 with
 * stale-relative-to-the-client state — notably the relationship-only mutations
 * ({@code addFollower}, {@code removeFollower}, {@code updateVote},
 * {@code DataContractRepository.updateLatestResult}) that don't bump entity {@code version} or
 * {@code updatedAt} and therefore leave the ETag unchanged. With {@code no-store} the browser
 * never caches a body, so the only conditional-GET path is our explicit Axios interceptor,
 * which already invalidates its cache on every mutation response. We keep emitting the ETag
 * header so any future client (or our own interceptor) can opt in to conditional GETs.
 */
@Provider
public class ETagResponseFilter implements ContainerResponseFilter {

  private static final String CACHE_CONTROL_VALUE = "no-store";
  private static final String GET = "GET";
  private static final Set<String> MUTATION_METHODS = Set.of("PUT", "POST", "PATCH");

  @Override
  public void filter(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    try (var ignored = RequestLatencyContext.phase("etagGeneration")) {
      if (shouldEmitETag(requestContext, responseContext)) {
        applyETag(requestContext, responseContext);
      }
    }
  }

  /**
   * Emit an ETag on successful entity reads (GET 200) and on successful mutations (PUT/POST/PATCH
   * 200/201). Emitting it on mutation responses lets a client chain a follow-up conditional write
   * ({@code If-Match}) without an intervening GET.
   */
  private static boolean shouldEmitETag(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    boolean result = false;
    if (responseContext.getEntity() instanceof EntityInterface) {
      String method = requestContext.getMethod();
      int status = responseContext.getStatus();
      boolean successfulRead = GET.equals(method) && status == Response.Status.OK.getStatusCode();
      boolean successfulMutation =
          MUTATION_METHODS.contains(method)
              && (status == Response.Status.OK.getStatusCode()
                  || status == Response.Status.CREATED.getStatusCode());
      result = successfulRead || successfulMutation;
    }
    return result;
  }

  private static void applyETag(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String etag = EntityETag.generateETag((EntityInterface) responseContext.getEntity());
    if (etag != null) {
      responseContext.getHeaders().putSingle(HttpHeaders.ETAG, etag);
      responseContext.getHeaders().putSingle(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL_VALUE);
      shortCircuitNotModified(requestContext, responseContext, etag);
    }
  }

  /** Conditional 304 short-circuit applies only to GET — mutations always run. */
  private static void shortCircuitNotModified(
      ContainerRequestContext requestContext,
      ContainerResponseContext responseContext,
      String etag) {
    String ifNoneMatch = requestContext.getHeaderString(HttpHeaders.IF_NONE_MATCH);
    if (GET.equals(requestContext.getMethod())
        && ifNoneMatch != null
        && matchesAny(ifNoneMatch, etag)) {
      // RFC 7232: 304 must NOT include a message body. Drop the entity so the
      // serializer emits an empty body. Headers (including ETag) are preserved.
      responseContext.setStatus(Response.Status.NOT_MODIFIED.getStatusCode());
      responseContext.setEntity(null);
    }
  }

  /**
   * RFC 7232 §3.2: {@code If-None-Match} can be {@code *} (match any), a single ETag, or a
   * comma-separated list. Weak comparison is used — we treat {@code "abc"} and {@code W/"abc"}
   * as matching, which is the spec's recommendation for cache-validation use.
   */
  private static boolean matchesAny(String ifNoneMatch, String currentEtag) {
    String trimmed = ifNoneMatch.trim();
    if ("*".equals(trimmed)) {
      return true;
    }
    String currentBare = stripWeakPrefix(currentEtag);
    for (String candidate : trimmed.split(",")) {
      if (currentBare.equals(stripWeakPrefix(candidate.trim()))) {
        return true;
      }
    }
    return false;
  }

  private static String stripWeakPrefix(String etag) {
    return etag.startsWith("W/") ? etag.substring(2) : etag;
  }
}
