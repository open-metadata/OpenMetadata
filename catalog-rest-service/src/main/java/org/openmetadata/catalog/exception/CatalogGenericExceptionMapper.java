/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.exception;

import io.dropwizard.jersey.errors.ErrorMessage;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.catalog.security.AuthenticationException;
import org.openmetadata.catalog.security.AuthorizationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.Path;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.concurrent.ThreadLocalRandom;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.UNAUTHORIZED;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.Family;



public class CatalogGenericExceptionMapper implements ExceptionMapper<Throwable> {
  private static final Logger LOG = LoggerFactory.getLogger(CatalogGenericExceptionMapper.class);

  public CatalogGenericExceptionMapper() {
  }

  @Override
  public Response toResponse(Throwable ex) {
    LOG.info("Exception ", ex);
    if (ex instanceof ProcessingException || ex instanceof IllegalArgumentException) {
      final Response response = BadRequestException.of().getResponse();
      return Response.fromResponse(response)
              .type(MediaType.APPLICATION_JSON_TYPE)
              .entity(new ErrorMessage(response.getStatus(), ex.getLocalizedMessage()))
              .build();
    } else if (ex instanceof UnableToExecuteStatementException) {
      // TODO remove this
      if (ex.getCause() instanceof SQLIntegrityConstraintViolationException) {
        return Response.status(CONFLICT)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(new ErrorMessage(CONFLICT.getStatusCode(), CatalogExceptionMessage.ENTITY_ALREADY_EXISTS))
                .build();

      }
    } else if (ex instanceof EntityNotFoundException) {
      return Response.status(NOT_FOUND)
              .type(MediaType.APPLICATION_JSON_TYPE)
              .entity(new ErrorMessage(NOT_FOUND.getStatusCode(), ex.getMessage()))
              .build();
    } else if (ex instanceof IngestionPipelineDeploymentException) {
      return Response.status(BAD_REQUEST)
              .type(MediaType.APPLICATION_JSON_TYPE)
              .entity(new ErrorMessage(BAD_REQUEST.getStatusCode(), ex.getMessage()))
              .build();
    } else if (ex instanceof AuthenticationException) {
      return Response.status(UNAUTHORIZED)
              .type(MediaType.APPLICATION_JSON_TYPE)
              .entity(new ErrorMessage(UNAUTHORIZED.getStatusCode(), ex.getMessage()))
              .build();
    } else if (ex instanceof AuthorizationException) {
      return Response.status(FORBIDDEN)
              .type(MediaType.APPLICATION_JSON_TYPE)
              .entity(new ErrorMessage(FORBIDDEN.getStatusCode(), ex.getMessage()))
              .build();
    } else if (ex instanceof WebServiceException) {
      final Response response = ((WebApplicationException) ex).getResponse();
      Family family = response.getStatusInfo().getFamily();
      if (family.equals(Response.Status.Family.REDIRECTION)) {
        return response;
      }
      if (family.equals(Family.SERVER_ERROR)) {
        throwException(ex);
      }

      return Response.fromResponse(response)
              .type(MediaType.APPLICATION_JSON_TYPE)
              .entity(new ErrorMessage(response.getStatus(), ex.getLocalizedMessage()))
              .build();
    }

    LOG.info("exception ", ex);
    logUnhandledException(ex);
    return new UnhandledServerException(ex.getMessage()).getResponse();
  }

  private void logUnhandledException(Throwable ex) {
    String errMessage = String.format("Got exception: [%s] / message [%s]",
            ex.getClass().getSimpleName(), ex.getMessage());
    StackTraceElement elem = findFirstResourceCallFromCallStack(ex.getStackTrace());
    String resourceClassName = null;
    if (elem != null) {
      errMessage += String.format(" / related resource location: [%s.%s](%s:%d)",
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
