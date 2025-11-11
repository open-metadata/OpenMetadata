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

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON_TYPE;
import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CONFLICT;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.Family;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.UNAUTHORIZED;

import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.sdk.exception.WebServiceException;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.AuthorizationException;
import org.postgresql.util.PSQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Slf4j
public class CatalogGenericExceptionMapper implements ExceptionMapper<Throwable> {
  @Override
  public Response toResponse(Throwable ex) {
    LOG.debug(ex.getMessage());
    if (ex instanceof ProcessingException
        || ex instanceof IllegalArgumentException
        || ex instanceof BadRequestException) {
      return getResponse(Response.status(Response.Status.BAD_REQUEST).build(), ex);
    } else if (ex instanceof UnableToExecuteStatementException) {
      if (ex.getCause() instanceof SQLIntegrityConstraintViolationException
          || ex.getCause() instanceof PSQLException
              && ex.getCause().getMessage().contains("duplicate")) {
        return getResponse(CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
      }
    } else if (ex instanceof EntityNotFoundException) {
      return getResponse(NOT_FOUND, ex.getLocalizedMessage());
    } else if (ex instanceof PreconditionFailedException) {
      return getResponse(Response.Status.PRECONDITION_FAILED, ex.getLocalizedMessage());
    } else if (ex instanceof IngestionPipelineDeploymentException) {
      return getResponse(BAD_REQUEST, ex.getLocalizedMessage());
    } else if (ex instanceof AuthenticationException) {
      return getResponse(UNAUTHORIZED, ex.getLocalizedMessage());
    } else if (ex instanceof AuthorizationException) {
      return getResponse(FORBIDDEN, ex.getLocalizedMessage());
    } else if (ex instanceof WebServiceException webServiceException) {
      final Response response = webServiceException.getResponse();
      Family family = response.getStatusInfo().getFamily();
      if (family.equals(Response.Status.Family.REDIRECTION)) {
        return response;
      }
      if (family.equals(Family.SERVER_ERROR)) {
        throwException(ex);
      }

      return getResponse(response, ex);
    }

    LOG.info("exception ", ex);
    logUnhandledException(ex);
    return new UnhandledServerException(ex.getMessage()).getResponse();
  }

  public Response getResponse(Response response, Throwable ex) {
    return Response.fromResponse(response)
        .type(APPLICATION_JSON_TYPE)
        .entity(new ErrorMessage(response.getStatus(), ex.getLocalizedMessage()))
        .build();
  }

  public static Response getResponse(Response.Status status, String message) {
    return Response.status(status)
        .type(APPLICATION_JSON_TYPE)
        .entity(new ErrorMessage(status.getStatusCode(), message))
        .header("WWW-Authenticate", "om-auth")
        .build();
  }

  private void logUnhandledException(Throwable ex) {
    String errMessage =
        String.format(
            "Got exception: [%s] / message [%s]", ex.getClass().getSimpleName(), ex.getMessage());
    StackTraceElement elem = findFirstResourceCallFromCallStack(ex.getStackTrace());
    String resourceClassName = null;
    if (elem != null) {
      errMessage +=
          String.format(
              " / related resource location: [%s.%s](%s:%d)",
              elem.getClassName(), elem.getMethodName(), elem.getFileName(), elem.getLineNumber());
      resourceClassName = elem.getClassName();
    }

    Logger log = getEffectiveLogger(resourceClassName);
    log.error(errMessage, ex);
  }

  protected void throwException(Throwable exception) {
    final long id = ThreadLocalRandom.current().nextLong();
    throwException(id, exception);
  }

  protected void throwException(long id, Throwable exception) {
    LOG.error(formatLogMessage(id), exception);
  }

  protected String formatLogMessage(long id) {
    return String.format("Error handling a request: %016x", id);
  }

  private StackTraceElement findFirstResourceCallFromCallStack(StackTraceElement[] stackTrace) {
    for (StackTraceElement stackTraceElement : stackTrace) {
      try {
        Class<?> aClass = Class.forName(stackTraceElement.getClassName());
        Path pathAnnotation = aClass.getAnnotation(Path.class);

        if (pathAnnotation != null) {
          return stackTraceElement;
        }
      } catch (ClassNotFoundException e) {
        // skip
      }
    }

    return null;
  }

  private Logger getEffectiveLogger(String resourceClassName) {
    Logger log = LOG;
    if (resourceClassName != null) {
      log = LoggerFactory.getLogger(resourceClassName);
    }
    return log;
  }
}
