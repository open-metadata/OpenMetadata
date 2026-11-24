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

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.service.jdbi3.PersonaRepository;

class PersonaContextDefinitionValidationTest {
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
