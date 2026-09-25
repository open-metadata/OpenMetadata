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

package org.openmetadata.service.rdf.agent;

import java.util.Objects;
import java.util.UUID;

/**
 * Who a request runs as. {@code effectiveUser} is the principal after the authentication filter's
 * validated impersonation swap; {@code serviceActor} is the impersonating bot, or {@code null} when
 * the caller acts as itself.
 */
public record AgentSparqlCaller(String requestId, String effectiveUser, String serviceActor) {
  public AgentSparqlCaller {
    Objects.requireNonNull(requestId);
    Objects.requireNonNull(effectiveUser);
  }

  public static AgentSparqlCaller of(final String effectiveUser, final String serviceActor) {
    return new AgentSparqlCaller(UUID.randomUUID().toString(), effectiveUser, serviceActor);
  }
}
