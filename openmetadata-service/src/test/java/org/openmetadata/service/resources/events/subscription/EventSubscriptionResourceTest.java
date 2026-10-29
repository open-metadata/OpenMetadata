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

package org.openmetadata.service.resources.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import org.junit.jupiter.api.Test;

/** ADR:2026-10-20-alert-forms-read-only-the-capabilities-answer */
class EventSubscriptionResourceTest {

  @Test
  void theDeprecatedListPointsToCapabilities() {
    assertEquals(
        "</api/v1/events/subscriptions/capabilities>; rel=\"alternate\"",
        EventSubscriptionResource.successorLink(servedAt("http://localhost:8585/api/")));
  }

  // BASE_PATH serves the whole server under a prefix, so a link from the root would miss it.
  @Test
  void theSuccessorLinkKeepsTheBasePath() {
    assertEquals(
        "</some-prefix/api/v1/events/subscriptions/capabilities>; rel=\"alternate\"",
        EventSubscriptionResource.successorLink(servedAt("https://host/some-prefix/api/")));
  }

  private static UriInfo servedAt(String baseUri) {
    UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getBaseUri()).thenReturn(URI.create(baseUri));
    return uriInfo;
  }
}
