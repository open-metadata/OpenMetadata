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

import java.util.List;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;

final class OntologyBulkPlanner {
  private final OntologyBulkTermCatalog termCatalog;
  private final OntologyBulkCsvPlanner csvPlanner;
  private final OntologyFindReplacePlanner findReplacePlanner;
  private final OntologyRelationshipRetypePlanner retypePlanner;

  OntologyBulkPlanner(
      final OntologyBulkTermCatalog termCatalog,
      final OntologyBulkCsvPlanner csvPlanner,
      final OntologyFindReplacePlanner findReplacePlanner,
      final OntologyRelationshipRetypePlanner retypePlanner) {
    this.termCatalog = termCatalog;
    this.csvPlanner = csvPlanner;
    this.findReplacePlanner = findReplacePlanner;
    this.retypePlanner = retypePlanner;
  }

  OntologyBulkPlan plan(
      final Glossary glossary, final OntologyBulkRequest request, final String user) {
    final List<GlossaryTerm> terms = termCatalog.list(glossary);
    final OntologyBulkPlan plan =
        switch (request.getOperation()) {
          case CSV_UPSERT -> csvPlanner.plan(glossary, request, terms, user);
          case FIND_REPLACE -> findReplacePlanner.plan(glossary, request, terms);
          case RETYPE_RELATIONSHIPS -> retypePlanner.plan(request, terms);
        };
    return plan;
  }
}
