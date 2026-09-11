package org.openmetadata.service.resources.governance;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.governance.EvaluateOnboarding;
import org.openmetadata.schema.api.governance.TransitionOnboarding;
import org.openmetadata.schema.governance.onboarding.OnboardingBackfill;
import org.openmetadata.schema.governance.onboarding.OnboardingBoard;
import org.openmetadata.schema.governance.onboarding.OnboardingProgress;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.onboarding.OnboardingBackfillService;
import org.openmetadata.service.governance.onboarding.OnboardingBoardService;
import org.openmetadata.service.governance.onboarding.OnboardingEvaluator;
import org.openmetadata.service.governance.onboarding.OnboardingService;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/governance/onboarding")
@Tag(name = "Onboarding", description = "Guided governance onboarding and workflow-backed gates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "onboarding", order = 9)
public class OnboardingResource {
  private final Authorizer authorizer;

  public OnboardingResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @POST
  @Path("/evaluate")
  public OnboardingProgress evaluate(
      @Context SecurityContext context, @Valid EvaluateOnboarding request) {
    String type = request.getEntityType().value();
    authorize(context, type, null, MetadataOperation.CREATE);
    var form = OnboardingService.configured(type);
    if (form == null) throw new NotFoundException("No enabled intake form for " + type);
    var steps = OnboardingEvaluator.evaluate(form, request.getEntity(), request.getStage());
    var blockers =
        steps.stream()
            .filter(step -> step.getRequired() && !OnboardingEvaluator.isSatisfied(step))
            .map(step -> step.getStep().getId())
            .toList();
    return new OnboardingProgress()
        .withConfigurationId(form.getId())
        .withConfigurationVersion(form.getVersion())
        .withStage(request.getStage())
        .withSteps(steps)
        .withBlockingSteps(blockers)
        .withCanAdvance(blockers.isEmpty())
        .withNextStatus(OnboardingEvaluator.nextStatus(request.getStage()));
  }

  @GET
  @Path("/{entityType}/{id}")
  public OnboardingProgress get(
      @Context SecurityContext context,
      @PathParam("entityType") String type,
      @PathParam("id") UUID id) {
    authorize(context, type, id, MetadataOperation.VIEW_ALL);
    return OnboardingService.get(type, id);
  }

  @POST
  @Path("/{entityType}/{id}/transition")
  public OnboardingProgress transition(
      @Context SecurityContext context,
      @PathParam("entityType") String type,
      @PathParam("id") UUID id,
      @Valid TransitionOnboarding request) {
    authorize(context, type, id, MetadataOperation.EDIT_ALL);
    return OnboardingService.transition(type, id, request, context.getUserPrincipal().getName());
  }

  @GET
  public OnboardingBoard list(
      @Context SecurityContext context,
      @QueryParam("entityType") String type,
      @QueryParam("stage") String stage,
      @QueryParam("domain") UUID domain,
      @QueryParam("assignee") UUID assignee,
      @QueryParam("after") String after,
      @QueryParam("limit") @DefaultValue("25") @Min(1) @Max(100) int limit) {
    return OnboardingBoardService.list(
        new OnboardingBoardService.Filter(type, stage, domain, assignee),
        after,
        limit,
        entity ->
            canView(
                context,
                entity,
                Entity.getEntityRepository(entity.getEntityReference().getType())));
  }

  @GET
  @Path("/backfill/{entityType}")
  public OnboardingBackfill backfill(
      @Context SecurityContext context, @PathParam("entityType") String type) {
    authorizer.authorizeAdmin(context);
    return OnboardingBackfillService.get(type);
  }

  @POST
  @Path("/backfill/{entityType}/retry")
  public OnboardingBackfill retryBackfill(
      @Context SecurityContext context, @PathParam("entityType") String type) {
    authorizer.authorizeAdmin(context);
    return OnboardingBackfillService.retry(type);
  }

  private void authorize(
      SecurityContext context, String type, UUID id, MetadataOperation operation) {
    OnboardingService.requireType(type);
    authorizer.authorize(
        context, new OperationContext(type, operation), new ResourceContext<>(type, id, null));
  }

  private <T extends EntityInterface> boolean canView(
      SecurityContext context, EntityInterface entity, EntityRepository<T> repository) {
    try {
      String type = repository.getEntityType();
      authorizer.authorize(
          context,
          new OperationContext(type, MetadataOperation.VIEW_ALL),
          new ResourceContext<>(type, repository.getEntityClass().cast(entity), repository));
      return true;
    } catch (AuthorizationException denied) {
      return false;
    }
  }
}
