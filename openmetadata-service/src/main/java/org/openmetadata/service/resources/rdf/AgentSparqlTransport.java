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

package org.openmetadata.service.resources.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.rdf.AgentSparqlError;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.AgentSparqlQuery;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.rdf.agent.AgentSparqlFailures;

/**
 * HTTP translation for {@code POST /v1/rdf/sparql/agent}: strict request reading and the stable
 * {@code {code, message, requestId}} error envelope. The generic exception mapper delegates here
 * for this path so authentication and impersonation failures raised by request filters, before the
 * resource method runs, use the same envelope. Every other endpoint keeps its existing errors.
 */
public final class AgentSparqlTransport {
  public static final String RESOURCE_PATH = "/sparql/agent";
  private static final String REQUEST_PATH =
      stripSlashes(RdfResource.COLLECTION_PATH + RESOURCE_PATH);
  private static final String AUTHENTICATE_CHALLENGE = "om-auth";

  private AgentSparqlTransport() {}

  public static boolean isAgentSparqlRequest(final UriInfo uriInfo) {
    return uriInfo != null && REQUEST_PATH.equalsIgnoreCase(stripSlashes(uriInfo.getPath()));
  }

  static String readQuery(final String requestBody) {
    final AgentSparqlQuery request;
    try {
      request =
          nullOrEmpty(requestBody)
              ? null
              : JsonUtils.readValue(requestBody, AgentSparqlQuery.class);
    } catch (JsonParsingException exception) {
      throw invalidBody(exception);
    }
    if (request == null) {
      throw invalidBody(null);
    }
    return request.getQuery();
  }

  public static Response errorResponse(final Throwable failure) {
    final AgentSparqlException classified = AgentSparqlFailures.classify(failure);
    final AgentSparqlErrorCode code = classified.getCode();
    final Response.ResponseBuilder response =
        Response.status(status(code))
            .type(MediaType.APPLICATION_JSON_TYPE)
            .entity(
                new AgentSparqlError()
                    .withCode(code)
                    .withMessage(classified.getMessage())
                    .withRequestId(
                        Objects.requireNonNullElseGet(
                            classified.getRequestId(), () -> UUID.randomUUID().toString())));
    if (code == AgentSparqlErrorCode.AUTHENTICATION_REQUIRED) {
      response.header(HttpHeaders.WWW_AUTHENTICATE, AUTHENTICATE_CHALLENGE);
    }
    return response.build();
  }

  static int status(final AgentSparqlErrorCode code) {
    return switch (code) {
      case QUERY_INVALID,
          QUERY_FORM_NOT_ALLOWED,
          GRAPH_SELECTION_NOT_ALLOWED,
          QUERY_LIMIT_EXCEEDED -> 400;
      case AUTHENTICATION_REQUIRED -> 401;
      case RDF_QUERY_FORBIDDEN, IMPERSONATION_NOT_ALLOWED, FEDERATION_NOT_ALLOWED -> 403;
      case RESULT_OUTPUT_LIMIT_EXCEEDED -> 413;
      case EXECUTION_CAPACITY_EXHAUSTED -> 429;
      case RDF_BACKEND_FAILURE -> 500;
      case EXECUTION_TIMEOUT, RDF_REPOSITORY_UNAVAILABLE, PROJECTION_NOT_READY -> 503;
    };
  }

  private static AgentSparqlException invalidBody(final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.QUERY_INVALID,
        "Request body must be a JSON object with only a string 'query' field",
        cause);
  }

  private static String stripSlashes(final String path) {
    return path.replaceAll("^/+|/+$", "");
  }
}
