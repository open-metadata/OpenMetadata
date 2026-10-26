package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.secrets.masker.WorkflowDefinitionMasker;

public final class McpResponseUtils {
  private static final Set<String> NOISE_FIELDS =
      Set.of(
          "version",
          "updatedAt",
          "updatedBy",
          "changeDescription",
          "incrementalChangeDescription",
          "followers",
          "votes",
          "sourceHash");

  private static final String CREATED = "created";
  private static final String VERSION_KEY = "version";
  private static final String CHANGED_KEY = "changed";
  private static final String UPDATED = "updated";
  private static final String OPERATION_KEY = "_operation";
  private static final String DELETED_KEY = "deleted";
  private static final List<String> WEBHOOK_SECRET_KEYS =
      List.of("secretKey", "clientId", "clientSecret");

  private McpResponseUtils() {}

  /**
   * Returns {@code entity} with the secrets the REST resource masks replaced by the mask, so an MCP
   * response or change event does not carry them: a workflow definition's sink credentials, a
   * service's connection config, an ingestion pipeline's source config, an automations workflow's
   * request, an alert's webhook credentials, and a user's authentication mechanism. That last one
   * is dropped rather than masked: the masker does not type every authentication mechanism, and no
   * agent task needs any user's credentials. Every other entity type is returned as is.
   *
   * <p>The mask applies to every caller, bots included: REST hands a bot the decrypted value, and no
   * agent task needs it. REST decrypts before masking; masking the stored value gives the same
   * result, since encryption and the masker walk the same {@code @PasswordField} getters. Each mask
   * runs on a copy, so the entity the repository returned keeps its values.
   * ADR:2026-10-20-mcp-responses-mask-stored-credentials
   */
  public static EntityInterface<?> maskSecrets(EntityInterface<?> entity) {
    // MCP tools read and write entities by a runtime entityType string, so the concrete type is
    // only known from the instance.
    EntityMasker masker = EntityMaskerFactory.getEntityMasker();
    return switch (entity) {
      case WorkflowDefinition definition -> WorkflowDefinitionMasker.mask(definition);
      case IngestionPipeline pipeline -> maskedCopy(pipeline, masker::maskIngestionPipeline);
      case User user -> maskedCopy(user, copy -> copy.setAuthenticationMechanism(null));
      case Workflow workflow -> masker.maskWorkflow(JsonUtils.deepCopy(workflow, Workflow.class));
      case EventSubscription subscription -> maskWebhookSecrets(subscription);
      case ServiceEntityInterface service -> maskConnection(service, masker);
      default -> entity;
    };
  }

  private static EntityInterface<?> maskConnection(
      ServiceEntityInterface service, EntityMasker masker) {
    EntityInterface<?> masked = service;
    // TestSuite implements ServiceEntityInterface with a placeholder connection and has no service
    // repository; it holds nothing to mask.
    if (service.getConnection() != null
        && Entity.getEntityRepository(Entity.getEntityTypeFromObject(service))
            instanceof ServiceEntityRepository<?, ?> repository) {
      ServiceType serviceType = repository.getServiceType();
      masked =
          maskedCopy(
              service,
              copy ->
                  copy.getConnection()
                      .setConfig(
                          masker.maskServiceConnectionConfig(
                              copy.getConnection().getConfig(),
                              copy.getServiceType().value(),
                              serviceType)));
    }
    return masked;
  }

  /** The webhook bearer and OAuth2 credentials SecretWebhookConfigRules stores encrypted. */
  private static EventSubscription maskWebhookSecrets(EventSubscription subscription) {
    JsonNode masked = JsonUtils.valueToTree(subscription);
    masked
        .path("destinations")
        .forEach(
            destination -> {
              if (destination.path("config").path("authType") instanceof ObjectNode auth) {
                WEBHOOK_SECRET_KEYS.stream()
                    .filter(auth::hasNonNull)
                    .forEach(key -> auth.put(key, PasswordEntityMasker.PASSWORD_MASK));
              }
            });
    return JsonUtils.treeToValue(masked, EventSubscription.class);
  }

  @SuppressWarnings("unchecked")
  private static <T extends EntityInterface<?>> T maskedCopy(T entity, Consumer<T> mask) {
    T copy = (T) JsonUtils.deepCopy(entity, entity.getClass());
    mask.accept(copy);
    return copy;
  }

  public static Map<String, Object> compact(EntityInterface<?> entity, EventType changeType) {
    Map<String, Object> doc = JsonUtils.getMap(maskSecrets(entity));
    NOISE_FIELDS.forEach(doc::remove);
    if (Boolean.FALSE.equals(doc.get(DELETED_KEY))) {
      doc.remove(DELETED_KEY);
    }
    doc.put(OPERATION_KEY, EventType.ENTITY_CREATED.equals(changeType) ? CREATED : UPDATED);
    return doc;
  }

  /**
   * {@link #compact} plus the two things only an update can answer: the new version, and which
   * fields actually changed.
   *
   * <p>{@link #compact} strips {@code changeDescription} because it is noise on a create - nothing
   * changed, the entity is new. On a patch it is the confirmation the caller wrote for. Only the
   * field names are kept: the full object carries old and new values for every field, far more than
   * "did my change land" needs.
   */
  public static Map<String, Object> compactPatch(EntityInterface<?> entity, EventType changeType) {
    Map<String, Object> doc = compact(entity, changeType);
    doc.put(VERSION_KEY, entity.getVersion());
    List<String> changed = changedFields(entity.getChangeDescription());
    if (!changed.isEmpty()) {
      doc.put(CHANGED_KEY, changed);
    }
    return doc;
  }

  private static List<String> changedFields(ChangeDescription change) {
    Set<String> names = new LinkedHashSet<>();
    if (change != null) {
      collectNames(change.getFieldsAdded(), names);
      collectNames(change.getFieldsUpdated(), names);
      collectNames(change.getFieldsDeleted(), names);
    }
    return new ArrayList<>(names);
  }

  private static void collectNames(List<FieldChange> changes, Set<String> names) {
    if (changes != null) {
      changes.stream().map(FieldChange::getName).filter(Objects::nonNull).forEach(names::add);
    }
  }
}
