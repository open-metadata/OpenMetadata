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

package org.openmetadata.service.exception;

import io.dropwizard.jersey.errors.ErrorMessage;
import io.lettuce.core.RedisException;
import jakarta.annotation.Priority;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.slf4j.Slf4j;

/**
 * Maps a Redis outage to {@code 503 Service Unavailable} with a {@code Retry-After} hint.
 *
 * <p>When {@code cache.provider: redis}, sessions live in Redis, so Redis being unreachable makes
 * every authenticated request fail. Without this mapper the Lettuce exception falls through to the
 * generic mapper and the client gets {@code 500} carrying the raw driver string ("Command timed out
 * after 300 millisecond(s)") — which reads as a server bug and tells callers not to retry. A 503
 * says "transient, come back", which is what actually happens: recovery is unattended once Redis is
 * back.
 */
@Slf4j
@Provider
@Priority(1)
public class SessionStoreUnavailableExceptionMapper implements ExceptionMapper<RedisException> {
  private static final int RETRY_AFTER_SECONDS = 5;

  @Override
  public Response toResponse(RedisException exception) {
    LOG.error("Redis is unavailable; returning 503 for this request", exception);
    return Response.status(Response.Status.SERVICE_UNAVAILABLE)
        .header(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS)
        .type(MediaType.APPLICATION_JSON_TYPE)
        .entity(
            new ErrorMessage(
                Response.Status.SERVICE_UNAVAILABLE.getStatusCode(),
                "The session store is temporarily unavailable. Please retry."))
        .build();
  }
}
