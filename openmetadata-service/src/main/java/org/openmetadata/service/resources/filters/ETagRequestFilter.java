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
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

/**
 * JAX-RS filter that extracts If-Match header from requests and stores it
 * in a ThreadLocal for use by the repository layer.
 */
@Slf4j
@Provider
public class ETagRequestFilter implements ContainerRequestFilter {

  private static final ThreadLocal<String> IF_MATCH_HEADER = new ThreadLocal<>();

  @Override
  public void filter(ContainerRequestContext requestContext) throws IOException {
    // Clear any previous value
    IF_MATCH_HEADER.remove();

    // Extract If-Match header if present
    String ifMatchHeader = requestContext.getHeaderString("If-Match");
    if (ifMatchHeader != null && !ifMatchHeader.isEmpty()) {
      IF_MATCH_HEADER.set(ifMatchHeader);
      LOG.debug("ETagRequestFilter: Stored If-Match header: {}", ifMatchHeader);
    } else {
      LOG.debug("ETagRequestFilter: No If-Match header found in request");
    }
  }

  public static String getIfMatchHeader() {
    return IF_MATCH_HEADER.get();
  }

  public static void clearIfMatchHeader() {
    IF_MATCH_HEADER.remove();
  }
}
