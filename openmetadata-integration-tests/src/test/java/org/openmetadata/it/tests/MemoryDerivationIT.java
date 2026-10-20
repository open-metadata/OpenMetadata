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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.DerivationEvidence;
import org.openmetadata.schema.entity.context.MemoryDerivation;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.center.MemoryDerivations;
import org.openmetadata.service.resources.context.ContextMemoryResource.MemoryDerivationList;

/**
 * The evidence an agent leaves on a term it derived from a memory reaches a reviewer only through
 * a memory that reviewer may see: the confidence and reasons quote the memory, so they follow its
 * visibility rather than the term's.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class MemoryDerivationIT {

  private static final String DERIVATIONS = "/v1/contextCenter/memories/derivations";
  private static final String PII_SENSITIVE = "PII.Sensitive";

  @Test
  void evidenceIsReadOnlyThroughMemoriesTheCallerMaySee(TestNamespace ns) {
    ContextMemory published = createMemory(ns, "published", MemoryVisibility.PUBLIC);
    ContextMemory ownersOnly = createMemory(ns, "ownersOnly", MemoryVisibility.PRIVATE);
    Glossary glossary = createGlossary(ns);
    GlossaryTerm fromPublished = createTerm(glossary, ns.prefix("fromPublished"));
    GlossaryTerm fromPrivate = createTerm(glossary, ns.prefix("fromPrivate"));
    MemoryDerivations derivations = new MemoryDerivations();
    derivations.record(
        published.getId(),
        fromPublished.getEntityReference(),
        evidence(0.92, "Defines a recurring metric"));
    derivations.record(
        ownersOnly.getId(), fromPrivate.getEntityReference(), evidence(0.8, "Quotes a secret"));

    List<MemoryDerivation> forAdmin =
        list(SdkClients.adminClient(), List.of(fromPublished, fromPrivate));
    List<MemoryDerivation> forOtherUser =
        list(SdkClients.user2Client(), List.of(fromPublished, fromPrivate));

    assertEquals(Set.of(fromPublished.getId(), fromPrivate.getId()), derivedIds(forAdmin));
    assertEquals(Set.of(fromPublished.getId()), derivedIds(forOtherUser));
    MemoryDerivation seen = forOtherUser.getFirst();
    assertEquals(published.getId(), seen.getMemory().getId());
    assertEquals(0.92, seen.getEvidence().getConfidence());
    assertEquals(List.of("Defines a recurring metric"), seen.getEvidence().getReasons());
    assertEquals("Memory Glossary Agent", seen.getEvidence().getAgent());
  }

  @Test
  void evidenceFollowsThePoliciesOnEachMemory(TestNamespace ns) {
    ContextMemory open = createMemory(ns, "openMemory", MemoryVisibility.PUBLIC, List.of());
    ContextMemory sensitive =
        createMemory(ns, "sensitiveMemory", MemoryVisibility.PUBLIC, List.of(piiSensitive()));
    Glossary glossary = createGlossary(ns);
    GlossaryTerm fromOpen = createTerm(glossary, ns.prefix("fromOpen"));
    GlossaryTerm fromSensitive = createTerm(glossary, ns.prefix("fromSensitive"));
    MemoryDerivations derivations = new MemoryDerivations();
    derivations.record(open.getId(), fromOpen.getEntityReference(), evidence(0.7, "Open"));
    derivations.record(
        sensitive.getId(), fromSensitive.getEntityReference(), evidence(0.9, "Sensitive"));
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("memdeny"),
            Entity.CONTEXT_MEMORY,
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('" + PII_SENSITIVE + "')");

    assertEquals(
        Set.of(fromOpen.getId()), derivedIds(list(denied, List.of(fromOpen, fromSensitive))));
  }

  @Test
  void aLinkWrittenWithoutEvidenceStillNamesItsMemory(TestNamespace ns) {
    ContextMemory memory = createMemory(ns, "noEvidence", MemoryVisibility.PUBLIC);
    GlossaryTerm term = createTerm(createGlossary(ns), ns.prefix("plainLink"));
    Entity.getEntityRepository(Entity.CONTEXT_MEMORY)
        .addRelationship(
            term.getId(),
            memory.getId(),
            Entity.GLOSSARY_TERM,
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM);

    List<MemoryDerivation> found = list(SdkClients.adminClient(), List.of(term));

    assertEquals(1, found.size());
    assertEquals(memory.getId(), found.getFirst().getMemory().getId());
    assertNull(found.getFirst().getEvidence());
  }

  @Test
  void rejectsMissingInvalidOrTooManyIds() {
    OpenMetadataClient admin = SdkClients.adminClient();
    String tooMany =
        IntStream.rangeClosed(0, MemoryDerivations.MAX_ENTITIES)
            .mapToObj(i -> UUID.randomUUID().toString())
            .collect(Collectors.joining(","));

    for (String ids : List.of("", "not-a-uuid", tooMany)) {
      OpenMetadataException rejected =
          assertThrows(OpenMetadataException.class, () -> get(admin, Entity.GLOSSARY_TERM, ids));
      assertEquals(400, rejected.getStatusCode());
    }
  }

  private static TagLabel piiSensitive() {
    return new TagLabel()
        .withTagFQN(PII_SENSITIVE)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static DerivationEvidence evidence(double confidence, String reason) {
    return new DerivationEvidence()
        .withAgent("Memory Glossary Agent")
        .withConfidence(confidence)
        .withReasons(List.of(reason))
        .withDerivedAt(System.currentTimeMillis());
  }

  private static List<MemoryDerivation> list(OpenMetadataClient client, List<GlossaryTerm> terms) {
    String ids =
        terms.stream().map(term -> term.getId().toString()).collect(Collectors.joining(","));
    return JsonUtils.readValue(get(client, Entity.GLOSSARY_TERM, ids), MemoryDerivationList.class)
        .getData();
  }

  private static String get(OpenMetadataClient client, String entityType, String entityIds) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityType", entityType)
            .queryParam("entityIds", entityIds)
            .build();
    return client.getHttpClient().executeForString(HttpMethod.GET, DERIVATIONS, null, options);
  }

  private static Set<UUID> derivedIds(List<MemoryDerivation> derivations) {
    return derivations.stream()
        .map(derivation -> derivation.getEntity().getId())
        .collect(Collectors.toSet());
  }

  private static ContextMemory createMemory(
      TestNamespace ns, String name, MemoryVisibility visibility) {
    return createMemory(ns, name, visibility, List.of());
  }

  private static ContextMemory createMemory(
      TestNamespace ns, String name, MemoryVisibility visibility, List<TagLabel> tags) {
    CreateContextMemory create =
        new CreateContextMemory()
            .withName(ns.prefix(name))
            .withTitle(name)
            .withQuestion("What does " + name + " define?")
            .withAnswer("A business concept a glossary term can hold.")
            .withEntityStatus(ContextMemoryStatus.APPROVED)
            .withOwners(List.of(SharedEntities.get().USER1_REF))
            .withShareConfig(new MemoryShareConfig().withVisibility(visibility))
            .withTags(tags);
    return ns.trackRoot(
        Entity.CONTEXT_MEMORY,
        new ContextMemoryService(SdkClients.adminClient().getHttpClient()).create(create));
  }

  private static Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("derivations"))
            .withDescription("Glossary holding terms derived from memories");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private static GlossaryTerm createTerm(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("A concept an agent derived from a memory")
            .withGlossary(glossary.getFullyQualifiedName());
    return SdkClients.adminClient().glossaryTerms().create(create);
  }
}
