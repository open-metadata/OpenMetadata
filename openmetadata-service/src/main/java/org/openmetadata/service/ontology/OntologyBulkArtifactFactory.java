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

package org.openmetadata.service.ontology;

import java.time.Clock;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.service.ontology.OntologyBulkPlan.Counts;

final class OntologyBulkArtifactFactory {
  private final Clock clock;

  OntologyBulkArtifactFactory(final Clock clock) {
    this.clock = clock;
  }

  OntologyBulkResultArtifact create(
      final Glossary glossary,
      final OntologyBulkRequest request,
      final OntologyBulkPlan plan,
      final OntologyChangeSet changeSet,
      final String user) {
    final Counts counts = plan.counts();
    return new OntologyBulkResultArtifact()
        .withId(UUID.randomUUID())
        .withOperation(plan.operation())
        .withGlossary(glossary.getEntityReference())
        .withDryRun(request.getDryRun())
        .withTotalRows(plan.totalRows())
        .withValidRows(plan.validRows())
        .withInvalidRows(plan.invalidRows())
        .withUnchangedRows(plan.unchangedRows())
        .withCreateCount(counts.creates())
        .withUpdateCount(counts.updates())
        .withFindReplaceCount(counts.findReplaces())
        .withRetypeCount(counts.retypes())
        .withErrors(plan.errors())
        .withErrorsTruncated(plan.errorsTruncated())
        .withChangeSet(changeSet == null ? null : changeSet.getEntityReference())
        .withGeneratedAt(clock.millis())
        .withGeneratedBy(user);
  }
}
