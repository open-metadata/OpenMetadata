package org.openmetadata.mcp.tools;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.resources.ontology.OntologyChangeSetResource;
import org.openmetadata.service.resources.ontology.OntologyEditLockResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/** Non-SPARQL ontology operations reuse the initialized, authorized REST actions. */
final class OntologyTool implements TypedMcpTool<Object> {
  enum Action {
    CREATE_RELATION,
    CREATE_CHANGE_SET,
    GET_CHANGE_SET,
    LEASE,
    SUBMIT
  }

  private final Action action;
  private final Resources resources;
  private final Function<CatalogSecurityContext, UriInfo> uriInfo;

  interface Resources {
    <T> T get(Class<T> type);
  }

  OntologyTool(final Action action) {
    this(action, OntologyTool::initializedResource, OntologyToolSupport::uriInfo);
  }

  OntologyTool(
      final Action action,
      final Resources resources,
      final Function<CatalogSecurityContext, UriInfo> uriInfo) {
    this.action = action;
    this.resources = resources;
    this.uriInfo = uriInfo;
  }

  @Override
  public Object execute(
      final Authorizer authorizer,
      final CatalogSecurityContext context,
      final Map<String, Object> values) {
    return switch (action) {
      case CREATE_RELATION -> createRelation(authorizer, context, RelationRequest.from(values));
      case CREATE_CHANGE_SET -> createChangeSet(context, proposal(values));
      case GET_CHANGE_SET -> readChangeSet(context, OntologyChangeSetPaging.Request.from(values));
      case LEASE -> lease(context, LeaseRequest.from(values));
      case SUBMIT -> submit(context, SubmitRequest.from(values));
    };
  }

  @Override
  public Object execute(
      final Authorizer authorizer,
      final Limits limits,
      final CatalogSecurityContext context,
      final Map<String, Object> values) {
    return execute(authorizer, context, values);
  }

  private Object createRelation(
      final Authorizer authorizer,
      final CatalogSecurityContext context,
      final RelationRequest request) {
    requireTermRead(authorizer, context, request.sourceTermId());
    requireTermRead(authorizer, context, request.targetTermId());
    final TermRelation relation =
        new TermRelation()
            .withTerm(
                new EntityReference().withType(Entity.GLOSSARY_TERM).withId(request.targetTermId()))
            .withRelationType(request.relationType())
            .withProvenance(RelationProvenance.AI_SUGGESTED);
    try (final Response response =
        resource(GlossaryTermResource.class)
            .addTermRelation(uriInfo.apply(context), context, request.sourceTermId(), relation)) {
      return OntologyToolSupport.writeResult(response, Entity.GLOSSARY_TERM, context);
    }
  }

  private static void requireTermRead(
      final Authorizer authorizer, final CatalogSecurityContext context, final UUID id) {
    authorizer.authorize(
        context,
        new OperationContext(Entity.GLOSSARY_TERM, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(Entity.GLOSSARY_TERM, id, null));
  }

  private Object createChangeSet(
      final CatalogSecurityContext context, final CreateOntologyChangeSet request) {
    try (final Response response =
        resource(OntologyChangeSetResource.class)
            .create(uriInfo.apply(context), context, request)) {
      return changeSetAcknowledgement(response, context);
    }
  }

  private Object readChangeSet(
      final CatalogSecurityContext context, final OntologyChangeSetPaging.Request request) {
    return OntologyChangeSetPaging.read(getChangeSet(context, request.id()), request);
  }

  private Object changeSetAcknowledgement(
      final Response response, final CatalogSecurityContext context) {
    final Map<String, Object> outcome =
        OntologyToolSupport.writeResult(response, Entity.ONTOLOGY_CHANGE_SET, context);
    return OntologyChangeSetPaging.acknowledgement(
        (OntologyChangeSet) response.getEntity(), outcome);
  }

  private OntologyChangeSet getChangeSet(final CatalogSecurityContext context, final UUID id) {
    return resource(OntologyChangeSetResource.class)
        .get(
            uriInfo.apply(context),
            context,
            id,
            "operations,applicationResult",
            Include.NON_DELETED);
  }

  private Object submit(final CatalogSecurityContext context, final SubmitRequest request) {
    getChangeSet(context, request.id());
    try (final Response response =
        resource(OntologyChangeSetResource.class)
            .submit(
                uriInfo.apply(context),
                context,
                request.id(),
                new OntologyChangeSetCommand().withLease(request.lease()))) {
      return changeSetAcknowledgement(response, context);
    }
  }

  private Object lease(final CatalogSecurityContext context, final LeaseRequest request) {
    getChangeSet(context, request.request().getResourceId());
    final OntologyEditLockResource locks = resource(OntologyEditLockResource.class);
    return switch (request.action()) {
      case ACQUIRE -> locks.acquire(context, request.request());
      case RELEASE -> release(locks, context, request.request());
    };
  }

  private ReleasedLease release(
      final OntologyEditLockResource locks,
      final CatalogSecurityContext context,
      final AcquireOntologyEditLock request) {
    try (final Response response =
        locks.release(
            context, Entity.ONTOLOGY_CHANGE_SET, request.getResourceId(), request.getSessionId())) {
      OntologyToolSupport.requireSuccess(response);
      return new ReleasedLease(
          request.getResourceId(), request.getSessionId(), response.getStatus() == 204);
    }
  }

  private <T> T resource(final Class<T> type) {
    return resources.get(type);
  }

  private static <T> T initializedResource(final Class<T> type) {
    return CollectionRegistry.getInstance().getResource(type);
  }

  static CreateOntologyChangeSet proposal(final Map<String, Object> values) {
    OntologyToolSupport.requireOnly(
        values,
        Set.of(
            "name",
            "displayName",
            "description",
            "glossaries",
            "ontology",
            "baseWorkingRevision",
            "operations"));
    return OntologyToolSupport.request(values, CreateOntologyChangeSet.class);
  }

  record RelationRequest(UUID sourceTermId, UUID targetTermId, String relationType) {
    static RelationRequest from(final Map<String, Object> values) {
      OntologyToolSupport.requireOnly(
          values, Set.of("sourceTermId", "targetTermId", "relationType"));
      return new RelationRequest(
          OntologyToolSupport.id(values, "sourceTermId"),
          OntologyToolSupport.id(values, "targetTermId"),
          McpToolParameters.from(values).requiredString("relationType"));
    }
  }

  record SubmitRequest(UUID id, OntologyEditLeaseToken lease) {
    static SubmitRequest from(final Map<String, Object> values) {
      OntologyToolSupport.requireOnly(values, Set.of("id", "lease"));
      if (!(values.get("lease") instanceof Map<?, ?>)) {
        throw new IllegalArgumentException("'lease' object is required");
      }
      final Map<?, ?> lease = (Map<?, ?>) values.get("lease");
      if (!(lease.get("version") instanceof Integer)
          || !(lease.get("sessionId") instanceof String)) {
        throw new IllegalArgumentException("lease requires a string sessionId and integer version");
      }
      return new SubmitRequest(
          OntologyToolSupport.id(values, "id"),
          OntologyToolSupport.request(values.get("lease"), OntologyEditLeaseToken.class));
    }
  }

  enum LeaseAction {
    ACQUIRE,
    RELEASE
  }

  record LeaseRequest(LeaseAction action, AcquireOntologyEditLock request) {
    static LeaseRequest from(final Map<String, Object> values) {
      OntologyToolSupport.requireOnly(
          values, Set.of("id", "action", "sessionId", "expectedVersion", "leaseSeconds"));
      final LeaseAction action =
          LeaseAction.valueOf(McpToolParameters.from(values).requiredString("action"));
      final AcquireOntologyEditLock request =
          new AcquireOntologyEditLock()
              .withResourceId(OntologyToolSupport.id(values, "id"))
              .withResourceType(Entity.ONTOLOGY_CHANGE_SET)
              .withSessionId(McpToolParameters.from(values).requiredString("sessionId"));
      if (values.containsKey("expectedVersion")) {
        request.setExpectedVersion(strictInteger(values, "expectedVersion"));
      }
      if (values.containsKey("leaseSeconds")) {
        request.setLeaseSeconds(strictInteger(values, "leaseSeconds"));
      }
      return new LeaseRequest(action, OntologyToolSupport.validated(request));
    }

    private static Integer strictInteger(final Map<String, Object> values, final String key) {
      final Object value = values.get(key);
      if (!(value instanceof Integer number)) {
        throw new IllegalArgumentException("'" + key + "' must be an integer");
      }
      return number;
    }
  }

  record ReleasedLease(UUID id, String sessionId, boolean released) {}
}
