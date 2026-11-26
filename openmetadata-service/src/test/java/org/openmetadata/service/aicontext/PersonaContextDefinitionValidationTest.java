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

package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PersonaRepository;

class PersonaContextDefinitionValidationTest {
  @Test
  void personaResponsesAndPutBodiesAcceptProjectedRules() {
    var rules =
        IntStream.rangeClosed(1, 51)
            .mapToObj(
                index -> new ContextRule().withName("Rule " + index).withEntityType(Entity.TABLE))
            .toList();
    var definition = new PersonaContextDefinition().withRules(rules.subList(0, 30));
    var persona =
        new Persona()
            .withId(UUID.randomUUID())
            .withName("company")
            .withContextDefinition(definition);
    var request = new CreatePersona().withName(persona.getName()).withContextDefinition(definition);
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      var violations = validator.validate(persona);
      assertTrue(violations.isEmpty(), violations::toString);
      definition.setRules(rules.subList(0, 50));
      assertTrue(validator.validate(request).isEmpty());
      definition.setRules(rules);
      assertEquals(
          "contextDefinition.rules",
          validator.validate(request).iterator().next().getPropertyPath().toString());
    }
  }

  @Test
  void enforcesTwentyFiveRulesForAuthoredDefinitions() {
    var rules =
        IntStream.rangeClosed(1, 26)
            .mapToObj(
                index -> new ContextRule().withName("Rule " + index).withEntityType(Entity.TABLE))
            .toList();
    PersonaRepository.validateContextDefinition(
        new PersonaContextDefinition().withRules(rules.subList(0, 25)));
    var failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                PersonaRepository.validateContextDefinition(
                    new PersonaContextDefinition().withRules(rules)));

    assertEquals("Persona context supports at most 25 rules", failure.getMessage());
  }

  @Test
  void trimsThePromptAndTreatsBlankAsUnset() {
    PersonaContextDefinition written =
        new PersonaContextDefinition().withPrompt("  You assist finance analysts.  \n");
    PersonaContextDefinition blank = new PersonaContextDefinition().withPrompt(" \n\t ");

    PersonaRepository.validateContextDefinition(written);
    PersonaRepository.validateContextDefinition(blank);

    assertEquals("You assist finance analysts.", written.getPrompt());
    assertNull(blank.getPrompt());
  }

  @Test
  void rejectsAPromptOverTheLimit() {
    // PATCH bypasses the request-body bean validation, so the schema's maxLength alone is not
    // enough to keep an oversized prompt out of every planner call.
    PersonaContextDefinition definition =
        new PersonaContextDefinition().withPrompt("x".repeat(8_001));

    assertThrows(
        IllegalArgumentException.class,
        () -> PersonaRepository.validateContextDefinition(definition));
  }
}
