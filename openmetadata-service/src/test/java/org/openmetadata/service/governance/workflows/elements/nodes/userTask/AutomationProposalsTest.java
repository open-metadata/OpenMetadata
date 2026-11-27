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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.DerivationEvidence;
import org.openmetadata.schema.entity.context.MemoryDerivation;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.AutomationProposal;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.GlossaryApprovalPayload;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;

class AutomationProposalsTest {
  private static final String PRIVATE_TITLE = "Q3 churn plan for the board";
  private static final String REASON = "The board deck defines churn by cancelled seats";

  private final GlossaryTerm term =
      new GlossaryTerm()
          .withId(UUID.randomUUID())
          .withName("Churn")
          .withFullyQualifiedName("Customers.Churn")
          .withDescription("Customers who cancel, as the board deck puts it.")
          .withProvider(ProviderType.AUTOMATION);

  @Test
  void namesTheAgentItsConfidenceAndItsMemoriesByIdOnly() {
    MemoryDerivation older = derivation(memory(), evidence("Glossary Agent", 0.6, 1L));
    MemoryDerivation newer = derivation(memory(), evidence("Glossary Agent v2", 0.92, 2L));

    GlossaryApprovalPayload payload = AutomationProposals.payloadFor(term, List.of(newer, older));
    AutomationProposal proposal = payload.getProposal();

    assertEquals(GlossaryApprovalPayload.Action.CREATE, payload.getAction());
    assertEquals(term.getId(), payload.getGlossaryTerm().getId());
    assertEquals(ProviderType.AUTOMATION, proposal.getProvider());
    assertEquals("Glossary Agent v2", proposal.getAgent());
    assertEquals(0.92, proposal.getConfidence());
    assertEquals(
        List.of(idOnly(newer.getMemory()), idOnly(older.getMemory())), proposal.getDerivedFrom());
  }

  @Test
  void carriesNothingAMemoryOrTheTermSays() {
    String json =
        JsonUtils.pojoToJson(
            AutomationProposals.payloadFor(
                term, List.of(derivation(memory(), evidence("Glossary Agent", 0.9, 1L)))));

    assertFalse(json.contains(PRIVATE_TITLE), json);
    assertFalse(json.contains(REASON), json);
    assertFalse(json.contains(term.getDescription()), json);
  }

  @Test
  void aTermApprovedOnceIsNoLongerAProposal() {
    EntityHistory underReview =
        new EntityHistory().withVersions(List.of(version("In Review"), version("Draft")));
    EntityHistory published =
        new EntityHistory()
            .withVersions(List.of(version("In Review"), version("Approved"), version("Draft")));

    assertFalse(AutomationProposals.hasApprovedVersion(underReview));
    assertTrue(AutomationProposals.hasApprovedVersion(published));
  }

  @Test
  void aProposalWithoutEvidenceNamesOnlyItsProvider() {
    AutomationProposal proposal = AutomationProposals.payloadFor(term, List.of()).getProposal();

    assertEquals(ProviderType.AUTOMATION, proposal.getProvider());
    assertNull(proposal.getAgent());
    assertNull(proposal.getConfidence());
    assertEquals(List.of(), proposal.getDerivedFrom());
  }

  private static String version(String entityStatus) {
    return JsonUtils.pojoToJson(
        new GlossaryTerm()
            .withName("Churn")
            .withEntityStatus(EntityStatus.fromValue(entityStatus)));
  }

  private static EntityReference memory() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("contextMemory")
        .withName("churn-plan")
        .withDisplayName(PRIVATE_TITLE)
        .withFullyQualifiedName("churn-plan");
  }

  private static EntityReference idOnly(EntityReference memory) {
    return new EntityReference().withId(memory.getId()).withType(memory.getType());
  }

  private static DerivationEvidence evidence(String agent, double confidence, long derivedAt) {
    return new DerivationEvidence()
        .withAgent(agent)
        .withConfidence(confidence)
        .withReasons(List.of(REASON))
        .withDerivedAt(derivedAt);
  }

  private MemoryDerivation derivation(EntityReference memory, DerivationEvidence evidence) {
    return new MemoryDerivation()
        .withEntity(new EntityReference().withId(term.getId()).withType("glossaryTerm"))
        .withMemory(memory)
        .withEvidence(evidence);
  }
}
