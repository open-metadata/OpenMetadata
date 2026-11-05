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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.ActiveDomainContext;

class PerRequestContextCleanerTest {

  @Test
  void clearDropsTheSelectedDomainSoAPooledThreadCannotInheritIt() {
    ActiveDomainContext.setActiveDomain(
        new EntityReference().withId(UUID.randomUUID()).withType("domain"));

    PerRequestContextCleaner.clear();

    assertNull(ActiveDomainContext.getActiveDomain());
  }
}
