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

import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.data.OntologyBulkExecutionMode;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.api.data.OntologyBulkSubmission;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;

public final class OntologyBulkExecutionService {
  public static final int MAXIMUM_SYNCHRONOUS_ROWS = 500;
  private final OntologyBulkRequestValidator validator;
  private final OntologyBulkPlanner planner;
  private final OntologyBulkDraftFactory draftFactory;
  private final OntologyBulkArtifactFactory artifactFactory;
  private final JobScheduler jobScheduler;

  OntologyBulkExecutionService(
      final OntologyBulkRequestValidator validator,
      final OntologyBulkPlanner planner,
      final OntologyBulkDraftFactory draftFactory,
      final OntologyBulkArtifactFactory artifactFactory,
      final JobScheduler jobScheduler) {
    this.validator = validator;
    this.planner = planner;
    this.draftFactory = draftFactory;
    this.artifactFactory = artifactFactory;
    this.jobScheduler = jobScheduler;
  }

  public OntologyBulkSubmission submit(
      final UriInfo uriInfo,
      final Glossary glossary,
      final OntologyBulkRequest request,
      final String user) {
    validator.validate(glossary, request);
    final OntologyBulkPlan plan = planner.plan(glossary, request, user);
    final OntologyBulkSubmission submission =
        plan.totalRows() > MAXIMUM_SYNCHRONOUS_ROWS
            ? background(glossary, request, plan, user)
            : synchronous(uriInfo, glossary, request, plan, user);
    return submission;
  }

  public OntologyBulkResultArtifact execute(
      final UriInfo uriInfo,
      final Glossary glossary,
      final OntologyBulkRequest request,
      final String user) {
    validator.validate(glossary, request);
    final OntologyBulkPlan plan = planner.plan(glossary, request, user);
    return executePlan(uriInfo, glossary, request, plan, user);
  }

  private OntologyBulkSubmission background(
      final Glossary glossary,
      final OntologyBulkRequest request,
      final OntologyBulkPlan plan,
      final String user) {
    final OntologyBulkJob job = jobScheduler.schedule(glossary, request, plan.totalRows(), user);
    return new OntologyBulkSubmission()
        .withExecutionMode(OntologyBulkExecutionMode.BACKGROUND)
        .withJob(job);
  }

  private OntologyBulkSubmission synchronous(
      final UriInfo uriInfo,
      final Glossary glossary,
      final OntologyBulkRequest request,
      final OntologyBulkPlan plan,
      final String user) {
    final OntologyBulkResultArtifact result = executePlan(uriInfo, glossary, request, plan, user);
    return new OntologyBulkSubmission()
        .withExecutionMode(OntologyBulkExecutionMode.SYNCHRONOUS)
        .withResult(result);
  }

  private OntologyBulkResultArtifact executePlan(
      final UriInfo uriInfo,
      final Glossary glossary,
      final OntologyBulkRequest request,
      final OntologyBulkPlan plan,
      final String user) {
    final OntologyChangeSet changeSet =
        shouldCreateDraft(request, plan)
            ? draftFactory.create(uriInfo, glossary, request, plan.operations(), user)
            : null;
    return artifactFactory.create(glossary, request, plan, changeSet, user);
  }

  private static boolean shouldCreateDraft(
      final OntologyBulkRequest request, final OntologyBulkPlan plan) {
    return !Boolean.TRUE.equals(request.getDryRun())
        && plan.invalidRows() == 0
        && !plan.operations().isEmpty();
  }

  @FunctionalInterface
  interface JobScheduler {
    OntologyBulkJob schedule(
        Glossary glossary, OntologyBulkRequest request, int totalRows, String user);
  }
}
