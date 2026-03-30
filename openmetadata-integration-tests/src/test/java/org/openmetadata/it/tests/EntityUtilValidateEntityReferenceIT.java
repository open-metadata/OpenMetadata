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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class EntityUtilValidateEntityReferenceIT {

  @Test
  void testValidateEntityReference_withExistingUser(TestNamespace ns) {
    User user = createUser(ns, "validate_ref");

    EntityReference ref = new EntityReference().withId(user.getId()).withType("user");
    EntityReference validated = EntityUtil.validateEntityReference(ref, "user");

    assertEquals(user.getId(), validated.getId());
    assertEquals(user.getName(), validated.getName());
    assertNotNull(validated.getFullyQualifiedName());
  }

  @Test
  void testValidateEntityReference_withoutExpectedType(TestNamespace ns) {
    User user = createUser(ns, "validate_no_type");

    EntityReference ref = new EntityReference().withId(user.getId()).withType("user");
    EntityReference validated = EntityUtil.validateEntityReference(ref);

    assertEquals(user.getId(), validated.getId());
    assertEquals(user.getName(), validated.getName());
  }

  @Test
  void testValidateEntityReference_withSharedEntity() {
    SharedEntities shared = SharedEntities.get();
    EntityReference ref = new EntityReference().withId(shared.USER1.getId()).withType("user");

    EntityReference validated = EntityUtil.validateEntityReference(ref, "user");

    assertEquals(shared.USER1.getId(), validated.getId());
    assertEquals(shared.USER1.getName(), validated.getName());
  }

  @Test
  void testValidateEntityReference_nullReferenceThrows() {
    assertThrows(
        IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(null, "user"));
  }

  @Test
  void testValidateEntityReference_nullIdThrows() {
    EntityReference ref = new EntityReference().withType("user");
    assertThrows(
        IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(ref, "user"));
  }

  @Test
  void testValidateEntityReference_nullTypeThrows() {
    UUID id = UUID.randomUUID();
    EntityReference ref = new EntityReference().withId(id);
    assertThrows(
        IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(ref, "user"));
    assertThrows(IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(ref));
  }

  @Test
  void testValidateEntityReference_emptyTypeThrows() {
    UUID id = UUID.randomUUID();
    EntityReference ref = new EntityReference().withId(id).withType("");
    assertThrows(
        IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(ref, "user"));
    assertThrows(IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(ref));
  }

  @Test
  void testValidateEntityReference_typeMismatchThrows() {
    SharedEntities shared = SharedEntities.get();
    EntityReference ref = new EntityReference().withId(shared.USER1.getId()).withType("user");

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class, () -> EntityUtil.validateEntityReference(ref, "table"));
    assertTrue(ex.getMessage().contains("user"));
    assertTrue(ex.getMessage().contains("table"));
  }

  @Test
  void testValidateEntityReference_nonExistentEntityThrows() {
    UUID randomId = UUID.randomUUID();
    EntityReference ref = new EntityReference().withId(randomId).withType("user");

    assertThrows(
        EntityNotFoundException.class, () -> EntityUtil.validateEntityReference(ref, "user"));
  }

  private User createUser(TestNamespace ns, String suffix) {
    String name = ns.prefix(suffix);
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(sanitized + "@test.openmetadata.org")
                .withDescription("Test user for validateEntityReference"));
  }
}
