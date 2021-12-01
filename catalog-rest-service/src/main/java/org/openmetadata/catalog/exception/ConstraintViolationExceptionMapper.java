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

package org.openmetadata.catalog.exception;

import com.google.common.collect.Iterables;
import io.dropwizard.jersey.errors.ErrorMessage;

import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Dropwizard by default maps the JSON constraint violations to 422 Response code. This overrides
 * that behavior by mapping the response code to 400 bad request.
 */
@Provider
public class ConstraintViolationExceptionMapper implements ExceptionMapper<ConstraintViolationException> {
  @Override
  public Response toResponse(ConstraintViolationException exception) {
    Set<ConstraintViolation<?>> constraintViolations = exception.getConstraintViolations();
    List<String> errorMessages = constraintViolations.stream()
            .map(constraintViolation -> {
              String name = Iterables.getLast(constraintViolation.getPropertyPath()).getName();
              return name + " " + constraintViolation.getMessage();
            })
            .collect(Collectors.toList());
    return Response.status(Response.Status.BAD_REQUEST)
            .entity(new ErrorMessage(Response.Status.BAD_REQUEST.getStatusCode(), errorMessages.toString()))
            .build();
  }
}

