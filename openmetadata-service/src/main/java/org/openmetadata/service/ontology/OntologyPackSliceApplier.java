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
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeApplicationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyPackSlice;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.resources.ontology.OntologyChangeSetMapper;

/** Applies one slice as a stamped change set through the regular change-set application path. */
public final class OntologyPackSliceApplier implements OntologyPackInstallJobHandler.SliceApplier {
  private final OntologyChangeSetRepository changeSets;
  private final OntologyChangeApplicationService applications;
  private final OntologyRepository ontologies;
  private final OntologyChangeSetMapper mapper = new OntologyChangeSetMapper();

  public OntologyPackSliceApplier(
      final OntologyChangeSetRepository changeSets,
      final OntologyChangeApplicationService applications,
      final OntologyRepository ontologies) {
    this.changeSets = changeSets;
    this.applications = applications;
    this.ontologies = ontologies;
  }

  @Override
  public void apply(final OntologyPackInstallJobHandler.SliceRequest request) {
    final long revision = ontologies.getState(request.ontologyId()).getWorkingRevision();
    final OntologyChangeSet draft =
        mapper.createToEntity(changeSet(request, revision), request.user());
    final OntologyChangeSet created = changeSets.create(null, draft, request.user(), null);
    final OntologyChangeSet applied =
        applications.apply(null, created.getId(), request.user()).getEntity();
    requireApplied(request, applied);
  }

  private static CreateOntologyChangeSet changeSet(
      final OntologyPackInstallJobHandler.SliceRequest request, final long revision) {
    final String name =
        "pack-install-%d-%d-%s"
            .formatted(
                request.jobId(),
                request.slice().index(),
                UUID.randomUUID().toString().substring(0, 8));
    return new CreateOntologyChangeSet()
        .withName(name)
        .withDisplayName(
            "Library install %s, slice %d of %d"
                .formatted(
                    request.source().getPackId(), request.slice().index() + 1, request.count()))
        .withDescription("Library install job " + request.jobId())
        .withOntology(request.ontologyFqn())
        .withBaseWorkingRevision(revision)
        .withOperations(request.slice().operations())
        .withUndoCursor(request.slice().operations().size())
        .withSourcePack(stamped(request));
  }

  private static OntologyPackSource stamped(
      final OntologyPackInstallJobHandler.SliceRequest request) {
    return new OntologyPackSource()
        .withPackId(request.source().getPackId())
        .withVersion(request.source().getVersion())
        .withModuleIds(request.source().getModuleIds())
        .withSlice(
            new OntologyPackSlice()
                .withJobId(request.jobId())
                .withIndex(request.slice().index())
                .withCount(request.count())
                .withPlanDigest(request.planDigest()));
  }

  private static void requireApplied(
      final OntologyPackInstallJobHandler.SliceRequest request, final OntologyChangeSet applied) {
    if (applied.getState() != OntologyChangeSetState.APPLIED) {
      throw new IllegalStateException(
          "Slice %d of %d did not apply: %s"
              .formatted(request.slice().index() + 1, request.count(), failure(applied)));
    }
  }

  private static String failure(final OntologyChangeSet changeSet) {
    final OntologyChangeApplicationResult result = changeSet.getApplicationResult();
    final List<OntologyChangeOperationResult> results =
        result == null ? List.of() : result.getResults();
    return results.stream()
        .filter(item -> item.getStatus() == OntologyChangeOperationResultStatus.FAILED)
        .map(OntologyChangeOperationResult::getMessage)
        .findFirst()
        .orElse("state " + changeSet.getState());
  }
}
