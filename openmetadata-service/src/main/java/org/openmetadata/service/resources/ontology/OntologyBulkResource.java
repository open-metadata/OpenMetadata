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

package org.openmetadata.service.resources.ontology;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkJobList;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.api.data.OntologyBulkSubmission;
import org.openmetadata.schema.api.data.OntologyBulkTemplate;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.ontology.OntologyBulkExecutionService;
import org.openmetadata.service.ontology.OntologyBulkJobManager;
import org.openmetadata.service.ontology.OntologyBulkServiceFactory;
import org.openmetadata.service.ontology.OntologyBulkServiceFactory.Components;
import org.openmetadata.service.ontology.OntologyBulkTemplateFactory;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Path("/v1/ontology/bulk")
@Tag(name = "Ontology Bulk", description = "Typed QTT-style Ontology Studio bulk authoring.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyBulk", order = 12)
public final class OntologyBulkResource {
  private static final int MAXIMUM_JOB_LIST_SIZE = 100;
  private final Authorizer authorizer;
  private final GlossaryRepository glossaryRepository;
  private final OntologyBulkExecutionService service;
  private final OntologyBulkJobManager jobManager;

  public OntologyBulkResource(final Authorizer authorizer) {
    this(authorizer, glossaryRepository(), OntologyBulkServiceFactory.createDefault());
  }

  OntologyBulkResource(
      final Authorizer authorizer,
      final GlossaryRepository glossaryRepository,
      final Components components) {
    this.authorizer = authorizer;
    this.glossaryRepository = glossaryRepository;
    this.service = components.service();
    this.jobManager = components.jobManager();
  }

  @GET
  @Path("/template")
  @Operation(
      operationId = "getOntologyBulkTemplate",
      summary = "Get the ontology bulk CSV template")
  public OntologyBulkTemplate template(@Context final SecurityContext securityContext) {
    subject(securityContext);
    return OntologyBulkTemplateFactory.create();
  }

  @POST
  @Operation(
      operationId = "submitOntologyBulkOperation",
      summary = "Validate or create a Draft from a typed ontology bulk operation")
  public OntologyBulkSubmission submit(
      @Context final UriInfo uriInfo,
      @Context final SecurityContext securityContext,
      @Valid final OntologyBulkRequest request) {
    final SubjectContext subject = subject(securityContext);
    final Glossary glossary = glossary(request);
    authorizeEdit(securityContext, glossary);
    return service.submit(uriInfo, glossary, request, subject.user().getName());
  }

  @GET
  @Path("/jobs")
  @Operation(operationId = "listOntologyBulkJobs", summary = "List the caller's ontology bulk jobs")
  public OntologyBulkJobList listJobs(
      @Context final SecurityContext securityContext,
      @QueryParam("limit") @DefaultValue("20") final int limit) {
    final String user = subject(securityContext).user().getName();
    return jobManager.list(user, boundedLimit(limit));
  }

  @GET
  @Path("/jobs/{jobId}")
  @Operation(operationId = "getOntologyBulkJob", summary = "Get an ontology bulk job")
  public OntologyBulkJob getJob(
      @Context final SecurityContext securityContext, @PathParam("jobId") final long jobId) {
    final SubjectContext subject = subject(securityContext);
    final OntologyBulkJob job = jobManager.get(jobId);
    requireAccess(subject, job);
    return job;
  }

  @PUT
  @Path("/jobs/{jobId}/cancel")
  @Operation(operationId = "cancelOntologyBulkJob", summary = "Cancel an ontology bulk job")
  public OntologyBulkJob cancelJob(
      @Context final SecurityContext securityContext, @PathParam("jobId") final long jobId) {
    final SubjectContext subject = subject(securityContext);
    requireAccess(subject, jobManager.get(jobId));
    return jobManager.requestCancel(jobId);
  }

  @GET
  @Path("/jobs/{jobId}/artifact")
  @Operation(
      operationId = "getOntologyBulkResultArtifact",
      summary = "Get the typed result artifact for a completed ontology bulk job")
  public OntologyBulkResultArtifact artifact(
      @Context final SecurityContext securityContext, @PathParam("jobId") final long jobId) {
    final SubjectContext subject = subject(securityContext);
    requireAccess(subject, jobManager.get(jobId));
    return jobManager.artifact(jobId);
  }

  private Glossary glossary(final OntologyBulkRequest request) {
    return glossaryRepository.get(null, request.getGlossaryId(), glossaryRepository.getFields(""));
  }

  private void authorizeEdit(final SecurityContext securityContext, final Glossary glossary) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, MetadataOperation.EDIT_GLOSSARY_TERMS),
        new ResourceContext<>(Entity.GLOSSARY, glossary, glossaryRepository));
  }

  private static void requireAccess(final SubjectContext subject, final OntologyBulkJob job) {
    final boolean canAccessAny = subject.isAdmin() || subject.isBot();
    if (!canAccessAny && !subject.user().getName().equals(job.getCreatedBy())) {
      throw new ForbiddenException("Ontology bulk job belongs to another user");
    }
  }

  private static SubjectContext subject(final SecurityContext securityContext) {
    return DefaultAuthorizer.getSubjectContext(securityContext);
  }

  private static int boundedLimit(final int limit) {
    return Math.min(Math.max(limit, 1), MAXIMUM_JOB_LIST_SIZE);
  }

  private static GlossaryRepository glossaryRepository() {
    return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  }
}
