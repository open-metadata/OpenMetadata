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

package org.openmetadata.service.docstore;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class PersonaLayoutDocumentTest {
  private static final String LAYOUT_FQN = "persona.DataQuality";
  private static final EntityReference DATA_QUALITY = persona("DataQuality");

  @Test
  void resolvesThePersonaOfALayoutDocument() {
    assertEquals(Optional.of("DataQuality"), PersonaLayoutDocument.personaFqnOf(LAYOUT_FQN));
    assertEquals(
        Optional.of("Data Quality"), PersonaLayoutDocument.personaFqnOf("persona.Data Quality"));
  }

  @Test
  void keepsAQuotedPersonaFqnWhole() {
    assertEquals(
        Optional.of("\"Data.Quality\""),
        PersonaLayoutDocument.personaFqnOf("persona.\"Data.Quality\""));
  }

  @Test
  void ignoresDocumentsThatAreNotPersonaLayouts() {
    assertFalse(PersonaLayoutDocument.personaFqnOf(null).isPresent());
    assertFalse(PersonaLayoutDocument.personaFqnOf("persona").isPresent());
    assertFalse(PersonaLayoutDocument.personaFqnOf("personas.DataQuality").isPresent());
    assertFalse(PersonaLayoutDocument.personaFqnOf("ActivityFeed").isPresent());
    assertFalse(PersonaLayoutDocument.personaFqnOf("persona.Data.Quality").isPresent());
  }

  @Test
  void rejectsAMalformedLayoutName() {
    assertThrows(
        IllegalArgumentException.class, () -> PersonaLayoutDocument.personaFqnOf("persona."));
  }

  @Test
  void aLayoutIsAssignedThroughEveryWayAUserHoldsThePersona() {
    assertTrue(isAssignedTo(new User().withPersonas(List.of(DATA_QUALITY))));
    assertTrue(isAssignedTo(new User().withInheritedPersonas(List.of(DATA_QUALITY))));
    assertTrue(isAssignedTo(new User().withDefaultPersona(DATA_QUALITY)));
  }

  @Test
  void anotherPersonasLayoutIsNotAssigned() {
    final EntityReference governance = persona("Governance");

    assertFalse(
        isAssignedTo(new User().withPersonas(List.of(governance)).withDefaultPersona(governance)));
  }

  @Test
  void aLayoutWhosePersonaNoLongerExistsIsNotAssigned() {
    final Supplier<SubjectContext> caller = callerWith(new User().withDefaultPersona(DATA_QUALITY));

    assertFalse(PersonaLayoutDocument.isAssignedTo(caller, LAYOUT_FQN, fqn -> Optional.empty()));
  }

  @Test
  void aDocumentThatIsNotALayoutIsNotAssigned() {
    final Supplier<SubjectContext> caller = callerWith(new User().withDefaultPersona(DATA_QUALITY));

    assertFalse(PersonaLayoutDocument.isAssignedTo(caller, "ActivityFeed", foundAs(DATA_QUALITY)));
  }

  private static boolean isAssignedTo(final User user) {
    return PersonaLayoutDocument.isAssignedTo(callerWith(user), LAYOUT_FQN, foundAs(DATA_QUALITY));
  }

  private static Supplier<SubjectContext> callerWith(final User user) {
    return () -> new SubjectContext(user, null);
  }

  private static Function<String, Optional<EntityReference>> foundAs(
      final EntityReference persona) {
    return fqn -> Optional.of(persona);
  }

  private static EntityReference persona(final String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.PERSONA)
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
