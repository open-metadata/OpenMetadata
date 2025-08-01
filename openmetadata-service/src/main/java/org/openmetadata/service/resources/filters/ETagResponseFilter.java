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

package org.openmetadata.service.resources.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.EntityETag;

/**
 * JAX-RS filter that automatically adds ETag headers to GET responses
 * containing EntityInterface entities.
 */
@Provider
public class ETagResponseFilter implements ContainerResponseFilter {

  @Override
  public void filter(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext)
      throws IOException {
    // Only add ETag for successful GET requests
    if ("GET".equals(requestContext.getMethod())
        && responseContext.getStatus() == Response.Status.OK.getStatusCode()
        && responseContext.getEntity() instanceof EntityInterface) {

      EntityInterface entity = (EntityInterface) responseContext.getEntity();
      String etag = EntityETag.generateETag(entity);
      responseContext.getHeaders().add("ETag", etag);
    }
  }
}
