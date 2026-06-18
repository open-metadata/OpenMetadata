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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ProviderType;

class OntologyOwnershipTest {

  // ---- helpers ----

  private static GlossaryTerm automationTerm(final String updatedBy) {
    return new GlossaryTerm()
        .withProvider(ProviderType.AUTOMATION)
        .withUpdatedBy(updatedBy)
        .withName("Revenue")
        .withDescription("original description");
  }

  private static GlossaryTerm userTerm(final String updatedBy) {
    return new GlossaryTerm()
        .withProvider(ProviderType.USER)
        .withUpdatedBy(updatedBy)
        .withName("Revenue")
        .withDescription("original description");
  }

  private static Metric automationMetric(final String updatedBy) {
    return new Metric()
        .withProvider(ProviderType.AUTOMATION)
        .withUpdatedBy(updatedBy)
        .withName("ClickRate")
        .withDescription("original description");
  }

  // ---- cases ----

  @Test
  void humanPatchWithManagedChangeOnAutomationEntity_releases() {
    final GlossaryTerm term = automationTerm("alice");
    term.setDescription("new description");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(term, true, true);

    assertTrue(released);
    assertEquals(ProviderType.USER, term.getProvider());
  }

  @Test
  void botOwnUpdateDoesNotRelease() {
    final GlossaryTerm term = automationTerm(OntologyOwnership.ONTOLOGY_BOT_NAME);
    term.setDescription("re-derived description");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(term, true, true);

    assertFalse(released);
    assertEquals(ProviderType.AUTOMATION, term.getProvider());
  }

  @Test
  void alreadyUserProviderIsUntouched() {
    final GlossaryTerm term = userTerm("alice");
    term.setDescription("new description");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(term, true, true);

    assertFalse(released);
    assertEquals(ProviderType.USER, term.getProvider());
  }

  @Test
  void noManagedFieldChangeDoesNotRelease() {
    final GlossaryTerm term = automationTerm("alice");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(term, true, false);

    assertFalse(released);
    assertEquals(ProviderType.AUTOMATION, term.getProvider());
  }

  @Test
  void putOperationDoesNotRelease() {
    final GlossaryTerm term = automationTerm("alice");
    term.setDescription("new description");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(term, false, true);

    assertFalse(released);
    assertEquals(ProviderType.AUTOMATION, term.getProvider());
  }

  @Test
  void metricEntityReleasedOnHumanPatch() {
    final Metric metric = automationMetric("bob");
    metric.setDescription("updated description");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(metric, true, true);

    assertTrue(released);
    assertEquals(ProviderType.USER, metric.getProvider());
  }

  @Test
  void botMetricUpdateDoesNotRelease() {
    final Metric metric = automationMetric(OntologyOwnership.ONTOLOGY_BOT_NAME);
    metric.setDescription("re-derived description");

    final boolean released = OntologyOwnership.releaseIfHumanEdited(metric, true, true);

    assertFalse(released);
    assertEquals(ProviderType.AUTOMATION, metric.getProvider());
  }
}
