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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/**
 * The two log endpoints accept a pipeline Id (UUID) <em>or</em> its fullyQualifiedName. Both forms
 * arrive as a plain {@code String} path segment — a UUID is parsed first and the segment is treated
 * as an fqn only when that parse fails — so the guarantee to lock in is that the {@code id} path
 * parameter is a {@code String} (not a {@code UUID}); a {@code UUID}-typed parameter would reject an
 * fqn at the framework boundary before the resource could dispatch on it.
 */
class IngestionPipelineLogEndpointTest {

  private static Method findEndpoint(String name) {
    return Arrays.stream(IngestionPipelineResource.class.getMethods())
        .filter(m -> name.equals(m.getName()))
        .findFirst()
        .orElse(null);
  }

  private static java.lang.reflect.Parameter findIdParam(Method method) {
    return Arrays.stream(method.getParameters())
        .filter(
            p -> {
              PathParam pathParam = p.getAnnotation(PathParam.class);
              return pathParam != null && "id".equals(pathParam.value());
            })
        .findFirst()
        .orElse(null);
  }

  private static void assertLogEndpointAcceptsIdOrFqn(String methodName, String expectedPath) {
    Method method = findEndpoint(methodName);
    assertNotNull(method, methodName + " should be registered on the resource");
    assertNotNull(method.getAnnotation(GET.class), methodName + " must be a @GET method");

    Path pathAnnotation = method.getAnnotation(Path.class);
    assertNotNull(pathAnnotation, methodName + " must declare a @Path");
    assertEquals(expectedPath, pathAnnotation.value());

    java.lang.reflect.Parameter idParam = findIdParam(method);
    assertNotNull(idParam, methodName + " must have a @PathParam(\"id\") path parameter");
    // A String (not UUID) parameter is what lets the endpoint accept a fullyQualifiedName as well
    // as a UUID Id; this is the backward-compatible widening the fqn support relies on.
    assertEquals(
        String.class,
        idParam.getType(),
        methodName + " id path parameter must be a String so it accepts a UUID or an fqn");

    Schema schema = null;
    for (Annotation annotation : idParam.getAnnotations()) {
      if (annotation instanceof Parameter parameter) {
        schema = parameter.schema();
      }
    }
    assertNotNull(schema, methodName + " id parameter must document its schema");
    assertEquals(
        "string",
        schema.type(),
        methodName + " id parameter schema must advertise type=string (UUID or fqn)");
  }

  @Test
  void getLastIngestionLogsAcceptsIdOrFqn() {
    assertLogEndpointAcceptsIdOrFqn("getLastIngestionLogs", "/logs/{id}/last");
  }

  @Test
  void downloadLastIngestionLogsAcceptsIdOrFqn() {
    assertLogEndpointAcceptsIdOrFqn("downloadLastIngestionLogs", "/logs/{id}/last/download");
  }

  @Test
  void bothLogEndpointsShareTheSameIdOrFqnPathParameter() {
    // Guard against the two endpoints drifting apart: both must expose the id segment identically.
    java.lang.reflect.Parameter get = findIdParam(findEndpoint("getLastIngestionLogs"));
    java.lang.reflect.Parameter download = findIdParam(findEndpoint("downloadLastIngestionLogs"));
    assertNotNull(get);
    assertNotNull(download);
    assertTrue(
        get.getType() == String.class && download.getType() == String.class,
        "both log endpoints must accept the id segment as a String (UUID or fqn)");
  }
}
