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

import static jakarta.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;

/**
 * Answers a token the server could not confirm with 503 and {@code Retry-After}, in the error body
 * {@link CatalogGenericExceptionMapper} writes. The token is not rejected, so a client keeps it and
 * retries.
 */
@Slf4j
public class CredentialUnavailableExceptionMapper
    implements ExceptionMapper<CredentialUnavailableException> {
  @Override
  public Response toResponse(CredentialUnavailableException exception) {
    LOG.debug("Answering 503: {}", exception.getMessage(), exception);
    return Response.fromResponse(
            CatalogGenericExceptionMapper.getResponse(
                SERVICE_UNAVAILABLE, CredentialUnavailableException.CLIENT_MESSAGE))
        .header(HttpHeaders.RETRY_AFTER, String.valueOf(exception.retryAfterSeconds()))
        .build();
  }
}
