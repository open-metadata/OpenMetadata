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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.openmetadata.sdk.PipelineServiceClientInterface.DEPLOYMENT_ERROR;

import io.dropwizard.jersey.errors.ErrorMessage;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.api.rdf.AgentSparqlError;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.ImpersonationDeniedException;

/**
 * The agent SPARQL path gets the stable {@code {code, message, requestId}} envelope even for
 * failures raised by request filters; every other path keeps the existing error shape.
 */
class CatalogGenericExceptionMapperTest {
  @Test
  void agentPathDelegatesToTheStableEnvelope() {
    CatalogGenericExceptionMapper mapper = mapperForAgentPath();

    Response response = mapper.toResponse(new ImpersonationDeniedException("not allowed"));

    assertEquals(403, response.getStatus());
    AgentSparqlError error = (AgentSparqlError) response.getEntity();
    assertEquals(AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED, error.getCode());
    assertNotNull(error.getRequestId());
  }

  @Test
  void agentPathAuthenticationFailureIsUnauthorized() {
    CatalogGenericExceptionMapper mapper = mapperForAgentPath();

    Response response = mapper.toResponse(AuthenticationException.getTokenNotPresentException());

    assertEquals(401, response.getStatus());
    AgentSparqlError error = (AgentSparqlError) response.getEntity();
    assertEquals(AgentSparqlErrorCode.AUTHENTICATION_REQUIRED, error.getCode());
  }

  @Test
  void otherPathsKeepTheExistingErrorShape() {
    CatalogGenericExceptionMapper mapper = new CatalogGenericExceptionMapper();

    Response response = mapper.toResponse(new IllegalArgumentException("bad argument"));

    assertEquals(400, response.getStatus());
    assertTrue(
        response.getEntity() instanceof ErrorMessage, "Neighboring endpoints keep ErrorMessage");
  }

  @Test
  void aFailedRunIsSentWithTheStatusItWasRaisedWith() {
    // Airflow unreachable, Airflow answering 500, and the cluster rejecting the job.
    assertSentAs(503, triggerFailed(Response.Status.SERVICE_UNAVAILABLE));
    assertSentAs(500, triggerFailed(Response.Status.INTERNAL_SERVER_ERROR));
    assertSentAs(400, triggerFailed(Response.Status.BAD_REQUEST));
  }

  @Test
  void aFailedDeployIsStillABadRequest() {
    assertSentAs(
        400,
        IngestionPipelineDeploymentException.byMessage(
            "orders_metadata", DEPLOYMENT_ERROR, "Connection refused"));
  }

  private static IngestionPipelineDeploymentException triggerFailed(Response.Status status) {
    return IngestionPipelineDeploymentException.triggerFailed(
        "orders_metadata", "Connection refused", status);
  }

  private static void assertSentAs(int status, RuntimeException exception) {
    Response response = new CatalogGenericExceptionMapper().toResponse(exception);

    assertEquals(status, response.getStatus());
    ErrorMessage error = (ErrorMessage) response.getEntity();
    assertEquals(status, error.getCode());
    assertEquals(exception.getMessage(), error.getMessage());
  }

  private static CatalogGenericExceptionMapper mapperForAgentPath() {
    CatalogGenericExceptionMapper mapper = new CatalogGenericExceptionMapper();
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    when(uriInfo.getPath()).thenReturn("v1/rdf/sparql/agent");
    try {
      Field field = CatalogGenericExceptionMapper.class.getDeclaredField("uriInfo");
      field.setAccessible(true);
      field.set(mapper, uriInfo);
    } catch (ReflectiveOperationException exception) {
      throw new IllegalStateException(exception);
    }
    return mapper;
  }
}
