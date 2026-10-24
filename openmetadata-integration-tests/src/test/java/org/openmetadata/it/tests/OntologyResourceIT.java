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

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.OntologyDataGraph;
import org.openmetadata.schema.api.data.OntologySummary;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class OntologyResourceIT {
  private static final int TERM_COUNT = 7;

  @Test
  void returnsScopedBoundedOntologySummaryAndData(final TestNamespace namespace) {
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final List<GlossaryTerm> terms = createTerms(namespace, glossary);
    final GlossaryTermService service = SdkClients.adminClient().glossaryTerms();
    service.addRelation(terms.getFirst().getId(), terms.get(1).getId(), "relatedTo");

    final OntologySummary summary = service.ontologySummary(glossary.getFullyQualifiedName(), 5, 0);
    final OntologyDataGraph data = service.ontologyData(glossary.getFullyQualifiedName(), 12, 0, 4);

    assertThat(summary.getTotalTerms()).isEqualTo(TERM_COUNT);
    assertThat(summary.getTotalRelations()).isEqualTo(1);
    assertThat(summary.getIsolatedTerms()).isEqualTo(TERM_COUNT - 2);
    assertThat(summary.getIsolatedPreview()).hasSize(5);
    assertThat(summary.getIsolatedPreview())
        .allSatisfy(
            term -> {
              assertThat(term.getId()).isNotNull();
              assertThat(term.getName()).isNotBlank();
              assertThat(term.getFullyQualifiedName()).isNotBlank();
              assertThat(term.getName()).isNotEqualTo(term.getId().toString());
            });
    final GlossaryTerm displayNamedTerm = terms.get(2);
    assertThat(summary.getIsolatedPreview())
        .filteredOn(term -> term.getId().equals(displayNamedTerm.getId()))
        .singleElement()
        .satisfies(
            term -> {
              assertThat(term.getName()).isEqualTo(displayNamedTerm.getName());
              assertThat(term.getDisplayName()).isEqualTo(displayNamedTerm.getDisplayName());
            });
    assertThat(summary.getPaging().getLimit()).isEqualTo(5);
    assertThat(data.getClusters()).isEmpty();
    assertThat(data.getPaging().getLimit()).isEqualTo(12);
  }

  @Test
  void rejectsOntologyPagesAboveTheServerBounds(final TestNamespace namespace) {
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final GlossaryTermService service = SdkClients.adminClient().glossaryTerms();

    assertThrows(
        InvalidRequestException.class,
        () -> service.ontologyData(glossary.getFullyQualifiedName(), 13, 0, 4));
    assertThrows(
        InvalidRequestException.class,
        () -> service.ontologySummary(glossary.getFullyQualifiedName(), 21, 0));
  }

  @Test
  void assetGraphIncludesConnectedTermContextAndPreviewLineage(final TestNamespace namespace) {
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final GlossaryTerm parent =
        GlossaryTermTestFactory.createWithName(namespace, glossary, "parent");
    final GlossaryTerm child =
        GlossaryTermTestFactory.createChild(namespace, glossary, parent, "child");
    final GlossaryTermService service = SdkClients.adminClient().glossaryTerms();
    service.addRelation(parent.getId(), child.getId(), "relatedTo");
    final GlossaryTerm related = service.get(parent.getId().toString(), "relatedTerms");
    final var semanticId = related.getRelatedTerms().getFirst().getId();
    assertThat(semanticId).isNotNull();
    final String messagingService =
        MessagingServiceTestFactory.createKafka(namespace).getFullyQualifiedName();
    final Topic first = taggedTopic(namespace, messagingService, parent);
    final Topic second = taggedTopic(namespace, messagingService, parent);
    final Topic downstream = taggedTopic(namespace, messagingService, child);
    addLineage(first, downstream);
    addLineage(second, downstream);

    Awaitility.await("glossary graph includes indexed topic tags")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              final OntologyDataGraph graph =
                  service.ontologyData(glossary.getFullyQualifiedName(), 1, 0, 1);
              assertThat(graph.getPaging().getTotal()).isEqualTo(2);
              assertThat(graph.getClusters()).hasSize(2);
              assertThat(graph.getClusters().getFirst().getAssetCount()).isEqualTo(2);
              assertThat(graph.getClusters().get(1).getAssetCount()).isEqualTo(1);
            });

    final OntologyDataGraph firstPage =
        service.ontologyData(glossary.getFullyQualifiedName(), 1, 0, 1);
    assertThat(firstPage.getSeedTermIds()).containsExactly(parent.getId());
    assertThat(firstPage.getClusters())
        .extracting(cluster -> cluster.getTerm().getId())
        .containsExactly(parent.getId(), child.getId());
    assertThat(firstPage.getClusters().getFirst().getAssets()).hasSize(1);
    assertThat(firstPage.getClusters().getFirst().getAssets().getFirst().getId())
        .isIn(first.getId(), second.getId());
    assertThat(firstPage.getClusters().get(1).getAssets())
        .extracting(asset -> asset.getId())
        .containsExactly(downstream.getId());
    assertThat(firstPage.getEdges()).hasSize(2);
    assertThat(firstPage.getEdges())
        .anySatisfy(
            edge -> {
              assertThat(edge.getFrom()).isEqualTo(parent.getId());
              assertThat(edge.getTo()).isEqualTo(child.getId());
              assertThat(edge.getRelationType()).isEqualTo("parentOf");
            });
    assertThat(firstPage.getEdges())
        .anySatisfy(
            edge -> {
              assertThat(edge.getRelationType()).isEqualTo("relatedTo");
              assertThat(List.of(edge.getFrom(), edge.getTo()))
                  .containsExactlyInAnyOrder(parent.getId(), child.getId());
              assertThat(edge.getId()).isEqualTo(semanticId);
              assertThat(edge.getRelationshipType().getName()).isEqualTo("relatedTo");
            });
    assertThat(firstPage.getLineageEdges())
        .singleElement()
        .satisfies(
            edge -> {
              assertThat(edge.getFromEntity())
                  .isEqualTo(firstPage.getClusters().getFirst().getAssets().getFirst().getId());
              assertThat(edge.getToEntity()).isEqualTo(downstream.getId());
            });
    assertThat(firstPage.getPaging().getLimit()).isEqualTo(1);
    assertThat(firstPage.getPaging().getOffset()).isZero();
    assertThat(firstPage.getPaging().getTotal()).isEqualTo(2);

    final OntologyDataGraph secondPage =
        service.ontologyData(glossary.getFullyQualifiedName(), 1, 1, 2);
    assertThat(secondPage.getSeedTermIds()).containsExactly(child.getId());
    assertThat(secondPage.getClusters())
        .extracting(cluster -> cluster.getTerm().getId())
        .containsExactly(child.getId(), parent.getId());
    assertThat(secondPage.getClusters().get(1).getAssets())
        .extracting(asset -> asset.getId())
        .containsExactlyInAnyOrderElementsOf(Set.of(first.getId(), second.getId()));
    assertThat(secondPage.getLineageEdges()).hasSize(2);
    assertThat(secondPage.getPaging().getOffset()).isEqualTo(1);
    assertThat(secondPage.getPaging().getTotal()).isEqualTo(2);
  }

  private static Topic taggedTopic(
      TestNamespace namespace, String messagingService, GlossaryTerm term) {
    final Topic topic = TopicTestFactory.createSimple(namespace, messagingService);
    final Topic fetched = SdkClients.adminClient().topics().get(topic.getId().toString(), "tags");
    fetched.setTags(
        List.of(
            new TagLabel()
                .withTagFQN(term.getFullyQualifiedName())
                .withSource(TagLabel.TagSource.GLOSSARY)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)));
    return SdkClients.adminClient().topics().update(topic.getId().toString(), fetched);
  }

  private static void addLineage(Topic from, Topic to) {
    SdkClients.adminClient()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())));
  }

  private static List<GlossaryTerm> createTerms(
      final TestNamespace namespace, final Glossary glossary) {
    final List<GlossaryTerm> terms = new ArrayList<>();
    for (int index = 0; index < TERM_COUNT; index++) {
      final GlossaryTerm term =
          index == 2
              ? GlossaryTermTestFactory.createWithDisplayName(
                  namespace, glossary, "ontology" + index, "Ontology Display Name")
              : GlossaryTermTestFactory.createWithName(namespace, glossary, "ontology" + index);
      terms.add(term);
    }
    return List.copyOf(terms);
  }
}
