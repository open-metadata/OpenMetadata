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

package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import jakarta.ws.rs.BadRequestException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

class ActiveDomainContextTest {

  @Test
  void requestedDomainIsPercentDecodedWithALiteralPlus() {
    EntityReference domain = new EntityReference().withId(UUID.randomUUID()).withType("domain");
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      Entity.DOMAIN, "Verkäufe+EU.\"a b\"", Include.NON_DELETED))
          .thenReturn(domain);

      assertSame(domain, ActiveDomainContext.resolveRequested("Verk%C3%A4ufe+EU.%22a%20b%22"));
    }
  }

  @Test
  void unknownOrMalformedRequestedDomainIsABadRequest() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      eq(Entity.DOMAIN), anyString(), eq(Include.NON_DELETED)))
          .thenThrow(EntityNotFoundException.byName("missing"));

      assertThrows(
          BadRequestException.class, () -> ActiveDomainContext.resolveRequested("missing"));
      assertThrows(BadRequestException.class, () -> ActiveDomainContext.resolveRequested("%E"));
    }
  }
}
