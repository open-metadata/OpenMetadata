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

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.OntologyStudioDataGraph;
import org.openmetadata.schema.api.data.OntologyStudioSummary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class OntologyStudioResourceIT {
  private static final int TERM_COUNT = 7;

  @Test
  void returnsScopedBoundedStudioSummaryAndData(final TestNamespace namespace) {
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final List<GlossaryTerm> terms = createTerms(namespace, glossary);
    final GlossaryTermService service = SdkClients.adminClient().glossaryTerms();
    service.addRelation(terms.getFirst().getId(), terms.get(1).getId(), "relatedTo");

    final OntologyStudioSummary summary =
        service.studioSummary(glossary.getFullyQualifiedName(), 5, 0);
    final OntologyStudioDataGraph data =
        service.studioData(glossary.getFullyQualifiedName(), 12, 0, 4);

    assertThat(summary.getTotalTerms()).isEqualTo(TERM_COUNT);
    assertThat(summary.getTotalRelations()).isEqualTo(1);
    assertThat(summary.getIsolatedTerms()).isEqualTo(TERM_COUNT - 2);
    assertThat(summary.getIsolatedPreview()).hasSize(5);
    assertThat(summary.getPaging().getLimit()).isEqualTo(5);
    assertThat(data.getClusters()).isEmpty();
    assertThat(data.getPaging().getLimit()).isEqualTo(12);
  }

  @Test
  void rejectsStudioPagesAboveTheServerBounds(final TestNamespace namespace) {
    final Glossary glossary = GlossaryTestFactory.createSimple(namespace);
    final GlossaryTermService service = SdkClients.adminClient().glossaryTerms();

    assertThrows(
        InvalidRequestException.class,
        () -> service.studioData(glossary.getFullyQualifiedName(), 13, 0, 4));
    assertThrows(
        InvalidRequestException.class,
        () -> service.studioSummary(glossary.getFullyQualifiedName(), 21, 0));
  }

  private static List<GlossaryTerm> createTerms(
      final TestNamespace namespace, final Glossary glossary) {
    final List<GlossaryTerm> terms = new ArrayList<>();
    for (int index = 0; index < TERM_COUNT; index++) {
      terms.add(GlossaryTermTestFactory.createWithName(namespace, glossary, "studio" + index));
    }
    return List.copyOf(terms);
  }
}
