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
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;

public final class OntologyBulkServiceFactory {
  private OntologyBulkServiceFactory() {}

  public static Components createDefault() {
    final Clock clock = Clock.systemUTC();
    final GlossaryTermRepository termRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final OntologyChangeSetRepository changeSetRepository =
        (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET);
    final RelationshipTypeResolver relationshipTypes =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    final OntologyBulkJobManager jobManager = new OntologyBulkJobManager(Entity.getJobDAO(), clock);
    final OntologyBulkPlanner planner = planner(termRepository, relationshipTypes, clock);
    final OntologyBulkExecutionService service =
        service(changeSetRepository, planner, jobManager, clock);
    return new Components(service, jobManager);
  }

  private static OntologyBulkExecutionService service(
      final OntologyChangeSetRepository changeSetRepository,
      final OntologyBulkPlanner planner,
      final OntologyBulkJobManager jobManager,
      final Clock clock) {
    return new OntologyBulkExecutionService(
        new OntologyBulkRequestValidator(),
        planner,
        new OntologyBulkDraftFactory(changeSetRepository::create),
        new OntologyBulkArtifactFactory(clock),
        jobManager);
  }

  private static OntologyBulkPlanner planner(
      final GlossaryTermRepository termRepository,
      final RelationshipTypeResolver relationshipTypes,
      final Clock clock) {
    final OntologyBulkCsvPlanner csvPlanner =
        new OntologyBulkCsvPlanner(new OntologyBulkCsvParser(), new OntologyIriMinter(), clock);
    return new OntologyBulkPlanner(
        new RepositoryOntologyBulkTermCatalog(termRepository),
        csvPlanner,
        new OntologyFindReplacePlanner(),
        new OntologyRelationshipRetypePlanner(relationshipTypes));
  }

  public record Components(
      OntologyBulkExecutionService service, OntologyBulkJobManager jobManager) {}
}
