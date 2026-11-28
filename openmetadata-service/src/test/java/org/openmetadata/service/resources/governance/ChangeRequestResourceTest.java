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

package org.openmetadata.service.resources.governance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;

/**
 * Unit tests for the {@code statuses} query param parsing in {@link ChangeRequestResource}. The
 * param is a comma-separated list of {@link ChangeRequestStatus} values; an unknown token must
 * surface a 400 instead of an opaque empty result.
 */
class ChangeRequestResourceTest {

  @Test
  void nullParamYieldsNoFilter() {
    assertTrue(ChangeRequestResource.parseStatuses(null).isEmpty());
  }

  @Test
  void blankParamYieldsNoFilter() {
    assertTrue(ChangeRequestResource.parseStatuses("").isEmpty());
    assertTrue(ChangeRequestResource.parseStatuses("   ").isEmpty());
  }

  @Test
  void singleStatusIsParsed() {
    assertEquals(List.of("Pending"), ChangeRequestResource.parseStatuses("Pending"));
  }

  @Test
  void multipleStatusesAreParsedInOrder() {
    assertEquals(
        List.of("Pending", "Approved"), ChangeRequestResource.parseStatuses("Pending,Approved"));
  }

  @Test
  void surroundingSpacesAreTrimmed() {
    assertEquals(
        List.of("Pending", "Approved"),
        ChangeRequestResource.parseStatuses("  Pending ,  Approved  "));
  }

  @Test
  void emptyTokensAreDropped() {
    assertEquals(List.of("Pending"), ChangeRequestResource.parseStatuses("Pending,,"));
    assertEquals(
        List.of("Pending", "Approved"), ChangeRequestResource.parseStatuses(",Pending,Approved,"));
  }

  @Test
  void duplicateStatusesAreDeduplicated() {
    assertEquals(List.of("Pending"), ChangeRequestResource.parseStatuses("Pending,Pending"));
  }

  @Test
  void unknownStatusThrowsBadRequest() {
    BadRequestException e =
        assertThrows(BadRequestException.class, () -> ChangeRequestResource.parseStatuses("Nope"));
    assertTrue(e.getMessage().contains("Nope"));
    assertTrue(e.getMessage().contains("Pending"));
  }

  @Test
  void unknownStatusAmongValidOnesThrowsBadRequest() {
    BadRequestException e =
        assertThrows(
            BadRequestException.class, () -> ChangeRequestResource.parseStatuses("Pending,Nope"));
    assertTrue(e.getMessage().contains("Nope"));
  }

  @Test
  void everyStatusValueIsAccepted() {
    for (ChangeRequestStatus status : ChangeRequestStatus.values()) {
      assertEquals(List.of(status.value()), ChangeRequestResource.parseStatuses(status.value()));
    }
  }
}
