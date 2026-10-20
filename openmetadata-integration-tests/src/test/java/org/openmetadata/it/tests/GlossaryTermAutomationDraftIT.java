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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;

/**
 * A term an automation provides, such as one an AI agent derived from a memory, starts in Draft and
 * is decided by people directly: the approval workflow never starts for a bot's write, so nothing
 * else would ever move it.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermAutomationDraftIT {

  @Test
  void anAutomationTermWaitsInDraftUntilSomeoneWhoCanEditItApprovesIt(TestNamespace ns) {
    Glossary glossary = createGlossary(ns, "noReviewers", List.of());

    GlossaryTerm derived = createTermAsBot(glossary, ns.prefix("derived"), ProviderType.AUTOMATION);
    GlossaryTerm curated =
        createTerm(SdkClients.adminClient(), glossary, ns.prefix("curated"), null);

    assertEquals(EntityStatus.DRAFT, derived.getEntityStatus());
    assertEquals(EntityStatus.APPROVED, curated.getEntityStatus());
    assertEquals(
        EntityStatus.APPROVED,
        setStatus(SdkClients.adminClient(), derived, EntityStatus.APPROVED).getEntityStatus());
    assertEquals(EntityStatus.APPROVED, reload(derived).getEntityStatus());
  }

  @Test
  void onlyAReviewerDecidesAnAutomationTermInAReviewedGlossary(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1.getEntityReference();
    Glossary glossary = createGlossary(ns, "reviewed", List.of(reviewer));
    GlossaryTerm rejected =
        createTermAsBot(glossary, ns.prefix("rejected"), ProviderType.AUTOMATION);
    GlossaryTerm approved =
        createTermAsBot(glossary, ns.prefix("approved"), ProviderType.AUTOMATION);

    OpenMetadataException notReviewer =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.adminClient(), approved, EntityStatus.APPROVED));

    assertEquals(403, notReviewer.getStatusCode());
    assertEquals(EntityStatus.DRAFT, reload(approved).getEntityStatus());
    assertEquals(
        EntityStatus.APPROVED,
        setStatus(SdkClients.user1Client(), approved, EntityStatus.APPROVED).getEntityStatus());
    assertEquals(
        EntityStatus.REJECTED,
        setStatus(SdkClients.user1Client(), rejected, EntityStatus.REJECTED).getEntityStatus());
  }

  @Test
  void aBotDraftFromAnyOtherProviderStillBelongsToTheApprovalWorkflow(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1.getEntityReference();
    Glossary glossary = createGlossary(ns, "workflowOwned", List.of(reviewer));
    GlossaryTerm draft = createTermAsBot(glossary, ns.prefix("botDraft"), null);

    assertEquals(EntityStatus.DRAFT, draft.getEntityStatus());
    OpenMetadataException ownedByWorkflow =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.user1Client(), draft, EntityStatus.APPROVED));
    assertEquals(403, ownedByWorkflow.getStatusCode());
    assertEquals(EntityStatus.DRAFT, reload(draft).getEntityStatus());
  }

  @Test
  void aPersonsEditOfAnAutomationDraftGoesToItsReviewers(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1.getEntityReference();
    Glossary glossary = createGlossary(ns, "editedDraft", List.of(reviewer));
    GlossaryTerm draft = createTermAsBot(glossary, ns.prefix("edited"), ProviderType.AUTOMATION);
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"A sharper definition\"}]";

    SdkClients.adminClient().glossaryTerms().patch(draft.getId(), JsonUtils.readTree(patch));

    // The approval workflow, not a person, moves the edited draft into review: it is not refused.
    Task task = awaitOpenApprovalTask(draft);
    assertEquals(EntityStatus.IN_REVIEW, reload(draft).getEntityStatus());
    assertEquals(
        List.of(reviewer.getId()),
        task.getAssignees().stream().map(EntityReference::getId).toList());
  }

  @Test
  void onlyABotCanSayAnAutomationProvidesATerm(TestNamespace ns) {
    Glossary glossary = createGlossary(ns, "spoofed", List.of());

    GlossaryTerm requested =
        createTerm(
            SdkClients.adminClient(), glossary, ns.prefix("spoofed"), ProviderType.AUTOMATION);
    String patch = "[{\"op\":\"replace\",\"path\":\"/provider\",\"value\":\"automation\"}]";
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .glossaryTerms()
                    .patch(requested.getId(), JsonUtils.readTree(patch)));

    assertEquals(ProviderType.USER, requested.getProvider());
    assertEquals(EntityStatus.APPROVED, requested.getEntityStatus());
    assertEquals(400, refused.getStatusCode());
    assertEquals(ProviderType.USER, reload(requested).getProvider());
  }

  @Test
  void aBotCannotDecideAnAutomationDraft(TestNamespace ns) {
    Glossary glossary = createGlossary(ns, "botDecides", List.of());
    GlossaryTerm draft =
        createTermAsBot(glossary, ns.prefix("selfApproved"), ProviderType.AUTOMATION);

    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.botClient(), draft, EntityStatus.APPROVED));

    assertEquals(403, refused.getStatusCode());
    assertTrue(refused.getMessage().contains("a bot cannot"), refused.getMessage());
    assertEquals(EntityStatus.DRAFT, reload(draft).getEntityStatus());
  }

  private static Glossary createGlossary(
      TestNamespace ns, String name, List<EntityReference> reviewers) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix(name))
            .withDescription("Glossary for automation-provided drafts")
            .withReviewers(reviewers);
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private static GlossaryTerm createTermAsBot(
      Glossary glossary, String name, ProviderType provider) {
    return createTerm(SdkClients.botClient(), glossary, name, provider);
  }

  private static GlossaryTerm createTerm(
      OpenMetadataClient client, Glossary glossary, String name, ProviderType provider) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("A business concept the term defines")
            .withGlossary(glossary.getFullyQualifiedName())
            .withProvider(provider);
    return client.glossaryTerms().create(create);
  }

  private static GlossaryTerm setStatus(
      OpenMetadataClient client, GlossaryTerm term, EntityStatus status) {
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/entityStatus\",\"value\":\"" + status.value() + "\"}]";
    return client.glossaryTerms().patch(term.getId(), JsonUtils.readTree(patch));
  }

  private static Task awaitOpenApprovalTask(GlossaryTerm term) {
    Map<String, String> filters =
        Map.of(
            "limit",
            "100",
            "status",
            TaskEntityStatus.Open.value(),
            "aboutEntity",
            term.getFullyQualifiedName(),
            "fields",
            "assignees");
    return Awaitility.await("open approval task for " + term.getFullyQualifiedName())
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> SdkClients.adminClient().tasks().listWithFilters(filters).getData(),
            tasks -> !tasks.isEmpty())
        .getFirst();
  }

  private static GlossaryTerm reload(GlossaryTerm term) {
    return SdkClients.adminClient().glossaryTerms().get(term.getId().toString());
  }
}
