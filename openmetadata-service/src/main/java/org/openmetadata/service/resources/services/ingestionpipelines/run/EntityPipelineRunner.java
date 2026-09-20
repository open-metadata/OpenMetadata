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

package org.openmetadata.service.resources.services.ingestionpipelines.run;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.services.ingestionPipelines.RunIngestionPipelineForEntity;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.RunOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineSecrets;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Runs the pipeline of a given type that owns an entity, scoped to that entity alone. Every pipeline
 * type and entity type goes through the same steps - resolve the runnable pipeline, authorise the
 * trigger, check the scope is safe, resolve secrets, run - so what varies is only which pipelines
 * own an entity ({@link RunnablePipelineResolver}) and how a run is narrowed to it
 * ({@link SourceConfigScoper}).
 */
public class EntityPipelineRunner {

  private static final TableFilterScoper TABLE_FILTER_SCOPER = new TableFilterScoper();
  private static final Map<String, RunnablePipelineResolver> RESOLVERS =
      Map.of(
          Entity.TEST_CASE, new TestCasePipelineResolver(),
          Entity.TABLE, new TablePipelineResolver());
  private static final Map<PipelineType, SourceConfigScoper> SCOPERS =
      Map.of(
          PipelineType.TEST_SUITE,
          new TestCaseScoper(),
          PipelineType.PROFILER,
          TABLE_FILTER_SCOPER,
          PipelineType.AUTO_CLASSIFICATION,
          TABLE_FILTER_SCOPER,
          PipelineType.METADATA,
          new MetadataScoper(TABLE_FILTER_SCOPER));

  private final Authorizer authorizer;
  private final Limits limits;
  private final IngestionPipelineRepository repository;

  public EntityPipelineRunner(
      Authorizer authorizer, Limits limits, IngestionPipelineRepository repository) {
    this.authorizer = authorizer;
    this.limits = limits;
    this.repository = repository;
  }

  public PipelineServiceClientResponse run(
      UriInfo uriInfo, SecurityContext securityContext, RunIngestionPipelineForEntity request) {
    EntityLink entityLink = EntityLink.parse(request.getEntityLink());
    PipelineType pipelineType = request.getPipelineType();
    RunnablePipelineResolver resolver = resolverFor(entityLink, pipelineType);
    EntityInterface target =
        Entity.getEntity(entityLink, resolver.entityFields(), Include.NON_DELETED);
    authorizeView(securityContext, entityLink.getEntityType(), target);
    IngestionPipeline pipeline =
        runnablePipelineAmong(resolver.pipelinesOwning(target, pipelineType))
            .orElseThrow(() -> noRunnablePipeline(target, pipelineType));
    authorizeTrigger(securityContext, pipeline);
    SourceConfigScoper scoper = SCOPERS.get(pipelineType);
    scoper.checkScopable(pipeline);
    RunOptions options = RunOptions.withSourceConfigOverride(scoper.sourceConfigOverride(target));
    return runWithSecretsResolved(uriInfo, securityContext, pipeline, options);
  }

  // An entity can have several runnable pipelines of a type. The lowest id keeps the choice stable,
  // so a client listing them can check permission and run state on the one a run will use.
  static Optional<IngestionPipeline> runnablePipelineAmong(List<IngestionPipeline> pipelines) {
    return pipelines.stream()
        .filter(EntityPipelineRunner::isRunnable)
        .min(Comparator.comparing(pipeline -> pipeline.getId().toString()));
  }

  // Same rule as the pipeline's own Run action: a disabled pipeline's schedule is paused, so a run
  // would never start, and an undeployed one has nothing for the runner to execute.
  private static boolean isRunnable(IngestionPipeline pipeline) {
    return Boolean.TRUE.equals(pipeline.getEnabled())
        && Boolean.TRUE.equals(pipeline.getDeployed());
  }

  // A link to a field, or a pairing no resolver serves - usage or lineage for a table, a profiler
  // for a test case - has no pipeline that could run scoped to it.
  private static RunnablePipelineResolver resolverFor(
      EntityLink entityLink, PipelineType pipelineType) {
    RunnablePipelineResolver resolver = RESOLVERS.get(entityLink.getEntityType());
    boolean isSupported =
        resolver != null
            && entityLink.getFieldName() == null
            && resolver.pipelineTypes().contains(pipelineType);
    if (!isSupported) {
      throw new BadRequestException(
          String.format(
              "A %s pipeline cannot be run scoped to %s.",
              pipelineType.value(), entityLink.getLinkString()));
    }
    return resolver;
  }

  private static NotFoundException noRunnablePipeline(
      EntityInterface target, PipelineType pipelineType) {
    return new NotFoundException(
        String.format(
            "'%s' has no enabled, deployed %s ingestion pipeline to run.",
            target.getFullyQualifiedName(), pipelineType.value()));
  }

  // The run aims a pipeline at the entity the caller named, so a caller who may not see that entity
  // may not aim a pipeline at it either. The Trigger check covers the pipeline, not its target.
  private void authorizeView(
      SecurityContext securityContext, String entityType, EntityInterface target) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType, target.getId(), null));
  }

  // Same checks as the pipeline's own /trigger, so running it for one entity is never a way around
  // a policy that withholds Trigger on it, or around the limits on running it.
  private void authorizeTrigger(SecurityContext securityContext, IngestionPipeline pipeline) {
    OperationContext trigger =
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.TRIGGER);
    authorizer.authorize(
        securityContext,
        trigger,
        new ResourceContext<>(Entity.INGESTION_PIPELINE, pipeline.getId(), null));
    limits.enforceLimits(
        securityContext, new CreateResourceContext<>(Entity.INGESTION_PIPELINE, pipeline), trigger);
  }

  // As the pipeline's own /trigger does: the runner needs the decrypted connection and the bot's
  // server connection, and a caller without ViewAll on the pipeline does not get its source config.
  // The scope is unaffected, as it travels in the run options rather than in that config.
  private PipelineServiceClientResponse runWithSecretsResolved(
      UriInfo uriInfo,
      SecurityContext securityContext,
      IngestionPipeline pipeline,
      RunOptions options) {
    IngestionPipelineSecrets.decryptOrNullify(
        authorizer, securityContext, repository.getOpenMetadataApplicationConfig(), pipeline, true);
    ServiceEntityInterface service =
        Entity.getEntity(pipeline.getService(), "ingestionRunner", Include.NON_DELETED);
    return repository.runIngestionPipeline(uriInfo, pipeline, service, options);
  }
}
