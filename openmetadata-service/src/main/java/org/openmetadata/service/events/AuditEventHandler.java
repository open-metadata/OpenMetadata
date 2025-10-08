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

package org.openmetadata.service.events;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
public class AuditEventHandler implements EventHandler {
  public void init(OpenMetadataApplicationConfig config) {
    // Nothing to do
  }

  @Override
  public Void process(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    LOG.trace("AuditEventHandler is deprecated; change events drive audit logging.");
    return null;
  }

  public void close() {
    /* Nothing to do */
  }
}
