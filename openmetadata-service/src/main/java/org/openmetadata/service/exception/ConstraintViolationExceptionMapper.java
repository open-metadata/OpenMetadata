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

import com.google.common.collect.Iterables;
import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.List;
import java.util.Set;

/**
 * Dropwizard by default maps the JSON constraint violations to 422 Response code. This overrides that behavior by
 * mapping the response code to 400 bad request.
 */
@Provider
public class ConstraintViolationExceptionMapper
    implements ExceptionMapper<ConstraintViolationException> {
  @Override
  public Response toResponse(ConstraintViolationException exception) {
    Set<ConstraintViolation<?>> constraintViolations = exception.getConstraintViolations();
    List<String> errorMessages =
        constraintViolations.stream()
            .map(
                constraintViolation -> {
                  String name = Iterables.getLast(constraintViolation.getPropertyPath()).getName();
                  // Map common parameter names to more descriptive names for query parameters
                  if ("arg6".equals(name)) {
                    name = "query param limit";
                  } else if ("arg7".equals(name)) {
                    name = "query param before";
                  } else if ("arg8".equals(name)) {
                    name = "query param after";
                  }
                  return name + " " + constraintViolation.getMessage();
                })
            .toList();
    return Response.status(Response.Status.BAD_REQUEST)
        .entity(
            new ErrorMessage(Response.Status.BAD_REQUEST.getStatusCode(), errorMessages.toString()))
        .build();
  }
}
