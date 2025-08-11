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

package org.openmetadata.service.exception;

import com.fasterxml.jackson.databind.JsonMappingException;
import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.annotation.Priority;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/**
 * Dropwizard by default maps the JSON payload format issues (invalid URI etc.) violations to 400 Response with no error
 * message. This exception mapper overrides that behavior by including ErrorMessage json in the response along with the
 * error code.
 */
@Provider
@Priority(1) // Override the default JsonMappingExceptionMapper by setting the priority higher
public class JsonMappingExceptionMapper implements ExceptionMapper<JsonMappingException> {
  @Override
  public jakarta.ws.rs.core.Response toResponse(JsonMappingException exception) {
    final jakarta.ws.rs.core.Response response = BadRequestException.of().getResponse();
    return jakarta.ws.rs.core.Response.status(response.getStatus())
        .type(MediaType.APPLICATION_JSON_TYPE)
        .entity(new ErrorMessage(response.getStatus(), exception.getLocalizedMessage()))
        .build();
  }
}
