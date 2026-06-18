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

package org.openmetadata.service.util;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ProviderType;

/**
 * Utility class centralising the ontology-bot principal name and the adopt-on-touch guard. When a
 * human PATCH changes an agent-managed field on an AUTOMATION-owned entity the guard flips the
 * entity's provider from AUTOMATION to USER, releasing ownership permanently.
 */
public final class OntologyOwnership {

  public static final String ONTOLOGY_BOT_NAME = "ontology-bot";

  private OntologyOwnership() {}

  /**
   * Flips provider from AUTOMATION to USER when a human edits an agent-managed field via PATCH.
   *
   * @param updated the entity about to be stored (mutated in place when released)
   * @param isPatch true when the originating operation is a REST PATCH
   * @param managedFieldChanged true when at least one agent-managed field changed in this update
   * @return true when ownership was released; false in all other cases
   */
  public static boolean releaseIfHumanEdited(
      final EntityInterface updated, final boolean isPatch, final boolean managedFieldChanged) {
    boolean released = false;
    if (isPatch
        && managedFieldChanged
        && ProviderType.AUTOMATION.equals(updated.getProvider())
        && !ONTOLOGY_BOT_NAME.equals(updated.getUpdatedBy())) {
      setProvider(updated, ProviderType.USER);
      released = true;
    }
    return released;
  }

  private static void setProvider(final EntityInterface entity, final ProviderType provider) {
    if (entity instanceof GlossaryTerm term) {
      term.setProvider(provider);
    } else if (entity instanceof Metric metric) {
      metric.setProvider(provider);
    } else if (entity instanceof Glossary glossary) {
      glossary.setProvider(provider);
    }
  }
}
