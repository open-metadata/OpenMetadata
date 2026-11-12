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
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.openmetadata.service.rdf.storage.RdfStorageMaintenanceException;

/** RDF storage maintenance is temporary: the client is told to retry, not that the server broke. */
@Provider
public class RdfStorageMaintenanceExceptionMapper
    implements ExceptionMapper<RdfStorageMaintenanceException> {
  @Override
  public Response toResponse(final RdfStorageMaintenanceException exception) {
    final int status = Response.Status.SERVICE_UNAVAILABLE.getStatusCode();
    return Response.status(status)
        .header(HttpHeaders.RETRY_AFTER, Math.max(1, exception.getRetryAfter().toSeconds()))
        .entity(new ErrorMessage(status, exception.getMessage()))
        .build();
  }
}
