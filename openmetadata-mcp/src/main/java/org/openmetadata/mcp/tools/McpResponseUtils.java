package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.channel.DestinationSecrets;
import org.openmetadata.service.alerting.channel.ProfileWebhookSecrets;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.McpServerMasker;
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

  private static final Set<String> BULK_STRUCTURAL_FIELDS =
      Set.of(
          "columns",
          "tableConstraints",
          "joins",
          "schemaDefinition",
          "viewDefinition",
          "dataModel",
          "tasks",
          "features",
          "mlFeatures",
          "children",
          "charts",
          "dataModels",
          "sampleData",
          "tableProfilerConfig",
          "customMetrics",
          "fields",
          "messageSchema",
          "requestSchema",
          "responseSchema");

  private static final String ID_KEY = "id";
  private static final String NAME_KEY = "name";
  private static final String DISPLAY_NAME_KEY = "displayName";
  private static final String FQN_KEY = "fullyQualifiedName";
  private static final String ENTITY_TYPE_KEY = "entityType";
  private static final String ENTITY_STATUS_KEY = "entityStatus";
  private static final String UPDATED_AT_KEY = "updatedAt";
  private static final String EXTENSION_KEY = "extension";
  private static final String CREATED = "created";
  private static final String VERSION_KEY = "version";
  private static final String CHANGED_KEY = "changed";
  private static final String UPDATED = "updated";
  private static final String OPERATION_KEY = "_operation";
  private static final String DELETED_KEY = "deleted";
  private static final String PENDING_APPROVAL = "pendingApproval";
  private static final String CHANGE_REQUEST_ID_KEY = "changeRequestId";

  private static final List<String> IDENTITY_KEYS =
      List.of(ID_KEY, NAME_KEY, DISPLAY_NAME_KEY, FQN_KEY, ENTITY_STATUS_KEY);

  private static final Set<String> IDENTITY_KEY_SET = Set.copyOf(IDENTITY_KEYS);

  /**
   * Describes how {@link PatchEntityTool} wants a patched entity projected onto the MCP wire.
   * ADR:2026-11-17-mcp-patch-entity-returns-compact-confirmation
   */
  public record PatchProjectionSpec(
      String entityType,
      boolean fullResponse,
      Set<String> touchedFields,
      Set<String> touchedExtensionKeys,
      boolean replaceWholeExtension) {
    public PatchProjectionSpec {
      touchedFields = touchedFields == null ? Set.of() : Set.copyOf(touchedFields);
      touchedExtensionKeys =
          touchedExtensionKeys == null ? Set.of() : Set.copyOf(touchedExtensionKeys);
    }

    public static PatchProjectionSpec compact(
        final String entityType, final Set<String> touchedFields) {
      return new PatchProjectionSpec(entityType, false, touchedFields, Set.of(), false);
    }

    public static PatchProjectionSpec full(final String entityType) {
      return new PatchProjectionSpec(entityType, true, Set.of(), Set.of(), false);
    }
  }

  private McpResponseUtils() {}

  /**
   * Returns {@code entity} with the secrets the REST resource masks replaced by the mask, so an MCP
   * response or change event does not carry them: a workflow definition's sink credentials, a
   * service's connection config, an ingestion pipeline's source config, an automations workflow's
   * request, an alert's webhook credentials, and a user's authentication mechanism. That last one
   * is dropped rather than masked: the masker does not type every authentication mechanism, and no
   * agent task needs any user's credentials. A metric group's member list is dropped too, as REST
   * drops it: members are listed only through {@code /v1/metricGroups/{id}/metrics}, which leaves
   * out the metrics the caller cannot view. Every other entity type is returned as is.
   *
   * <p>The mask applies to every caller, bots included: REST hands a bot the decrypted value, and no
   * agent task needs it. REST decrypts before masking; masking the stored value gives the same
   * result, since encryption and the masker walk the same {@code @PasswordField} getters. Each mask
   * runs on a copy, so the entity the repository returned keeps its values.
   * ADR:2026-10-20-mcp-responses-mask-stored-credentials
   */
  public static EntityInterface<?> maskSecrets(final EntityInterface<?> entity) {
    // MCP tools read and write entities by a runtime entityType string, so the concrete type is
    // only known from the instance.
    final EntityMasker masker = EntityMaskerFactory.getEntityMasker();
    return switch (entity) {
      case McpServer server -> maskedCopy(server, McpServerMasker::mask);
      case WorkflowDefinition definition -> WorkflowDefinitionMasker.mask(definition);
      case IngestionPipeline pipeline -> maskedCopy(pipeline, masker::maskIngestionPipeline);
      case User user -> maskedCopy(
          user, copy -> ProfileWebhookSecrets.mask(copy.withAuthenticationMechanism(null)));
      case Team team -> maskedCopy(team, ProfileWebhookSecrets::mask);
      case MetricGroup group -> maskedCopy(group, copy -> copy.setMetrics(null));
      case Workflow workflow -> masker.maskWorkflow(JsonUtils.deepCopy(workflow, Workflow.class));
      case EventSubscription subscription -> maskWebhookSecrets(subscription);
      case ServiceEntityInterface service -> maskConnection(service, masker);
      default -> entity;
    };
  }

  private static EntityInterface<?> maskConnection(
      final ServiceEntityInterface service, final EntityMasker masker) {
    EntityInterface<?> masked = service;
    // TestSuite implements ServiceEntityInterface with a placeholder connection and has no service
    // repository; it holds nothing to mask.
    if (service.getConnection() != null
        && Entity.getEntityRepository(Entity.getEntityTypeFromObject(service))
            instanceof ServiceEntityRepository<?, ?> repository) {
      final ServiceType serviceType = repository.getServiceType();
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

  private static EventSubscription maskWebhookSecrets(final EventSubscription subscription) {
    return DestinationSecrets.mask(subscription);
  }

  @SuppressWarnings("unchecked")
  private static <T extends EntityInterface<?>> T maskedCopy(
      final T entity, final Consumer<T> mask) {
    final T copy = (T) JsonUtils.deepCopy(entity, entity.getClass());
    mask.accept(copy);
    return copy;
  }

  public static Map<String, Object> compact(
      final EntityInterface<?> entity, final EventType changeType) {
    final Map<String, Object> doc = new LinkedHashMap<>(safeEntityMap(entity));
    NOISE_FIELDS.forEach(doc::remove);
    if (Boolean.FALSE.equals(doc.get(DELETED_KEY))) {
      doc.remove(DELETED_KEY);
    }
    doc.put(OPERATION_KEY, EventType.ENTITY_CREATED.equals(changeType) ? CREATED : UPDATED);
    return doc;
  }

  public static Map<String, Object> projectPatch(
      final EntityInterface<?> entity, final EventType changeType, final PatchProjectionSpec spec) {
    return spec.fullResponse()
        ? fullPatch(entity, spec.entityType(), changeType)
        : compactPatch(entity, changeType, spec);
  }

  /**
   * Projects a patched entity into a compact confirmation carrying identity fields, version,
   * updatedAt, operation, changed field names, and touched non-bulk metadata.
   * ADR:2026-11-17-mcp-patch-entity-returns-compact-confirmation
   */
  public static Map<String, Object> compactPatch(
      final EntityInterface<?> entity, final EventType changeType) {
    // Used by Collate extensions and unit tests that invoke compactPatch without a JsonPatch.
    return compactPatch(entity, changeType, PatchProjectionSpec.compact(null, Set.of()));
  }

  public static Map<String, Object> compactPatch(
      final EntityInterface<?> entity,
      final String entityType,
      final EventType changeType,
      final Set<String> touchedFields) {
    return compactPatch(entity, changeType, PatchProjectionSpec.compact(entityType, touchedFields));
  }

  public static Map<String, Object> compactPatch(
      final EntityInterface<?> entity, final EventType changeType, final PatchProjectionSpec spec) {
    final Map<String, Object> fullMap = safeEntityMap(entity);
    final Map<String, Object> doc = new LinkedHashMap<>();
    copyIdentityEnvelope(fullMap, doc, entity, spec.entityType());
    final List<String> changed = effectiveChangedFields(entity, changeType);
    copyTouchedMetadata(fullMap, doc, spec, changed);
    appendConfirmationMetadata(doc, entity, changeType, changed);
    return doc;
  }

  /**
   * Returns the full secret-masked entity plus {@code entityType}, {@code version}, {@code
   * updatedAt}, {@code _operation}, and {@code changed} when {@code response="full"} is requested.
   * ADR:2026-11-17-mcp-patch-entity-returns-compact-confirmation
   */
  public static Map<String, Object> fullPatch(
      final EntityInterface<?> entity, final String entityType, final EventType changeType) {
    final Map<String, Object> doc = new LinkedHashMap<>(safeEntityMap(entity));
    NOISE_FIELDS.forEach(doc::remove);
    if (Boolean.FALSE.equals(doc.get(DELETED_KEY))) {
      doc.remove(DELETED_KEY);
    }
    putIfPresent(doc, ENTITY_TYPE_KEY, resolveEntityType(entity, entityType));
    final List<String> changed = effectiveChangedFields(entity, changeType);
    appendConfirmationMetadata(doc, entity, changeType, changed);
    return doc;
  }

  /**
   * Relabels {@code doc} when an approval workflow held the write as {@code changeRequestId}, the
   * id REST sends in {@code X-OpenMetadata-Pending-Change}. The entity in it is the published one,
   * so "updated" and its last change's field list would report a write that has not happened.
   * ADR:2026-11-13-an-mcp-write-an-approval-workflow-holds-answers-pending-approval
   */
  public static Map<String, Object> markHeld(
      final Map<String, Object> doc, final UUID changeRequestId) {
    if (changeRequestId != null) {
      doc.put(OPERATION_KEY, PENDING_APPROVAL);
      doc.put(CHANGE_REQUEST_ID_KEY, changeRequestId.toString());
      doc.remove(CHANGED_KEY);
    }
    return doc;
  }

  private static Map<String, Object> safeEntityMap(final EntityInterface<?> entity) {
    final Map<String, Object> mapped =
        entity == null ? null : JsonUtils.getMap(maskSecrets(entity));
    return mapped == null ? Map.of() : mapped;
  }

  private static void copyIdentityEnvelope(
      final Map<String, Object> fullMap,
      final Map<String, Object> doc,
      final EntityInterface<?> entity,
      final String explicitEntityType) {
    for (final String key : IDENTITY_KEYS) {
      putIfPresent(doc, key, fullMap.get(key));
    }
    putIfPresent(doc, ENTITY_TYPE_KEY, resolveEntityType(entity, explicitEntityType));
    if (Boolean.TRUE.equals(fullMap.get(DELETED_KEY))) {
      doc.put(DELETED_KEY, Boolean.TRUE);
    }
  }

  private static void copyTouchedMetadata(
      final Map<String, Object> fullMap,
      final Map<String, Object> doc,
      final PatchProjectionSpec spec,
      final List<String> changed) {
    for (final String field : candidateEchoFields(spec, changed)) {
      if (isEchoableField(field)) {
        copySingleField(fullMap, doc, field, spec);
      }
    }
  }

  private static Set<String> candidateEchoFields(
      final PatchProjectionSpec spec, final List<String> changed) {
    final Set<String> candidates = new LinkedHashSet<>(spec.touchedFields());
    for (final String name : changed) {
      if (name != null && !name.contains(".")) {
        candidates.add(name);
      }
    }
    return candidates;
  }

  private static boolean isEchoableField(final String field) {
    return !IDENTITY_KEY_SET.contains(field)
        && !ENTITY_TYPE_KEY.equals(field)
        && !DELETED_KEY.equals(field)
        && !BULK_STRUCTURAL_FIELDS.contains(field)
        && !NOISE_FIELDS.contains(field);
  }

  private static void copySingleField(
      final Map<String, Object> fullMap,
      final Map<String, Object> doc,
      final String field,
      final PatchProjectionSpec spec) {
    if (EXTENSION_KEY.equals(field)) {
      copyExtensionField(fullMap, doc, spec);
    } else {
      putIfPresent(doc, field, fullMap.get(field));
    }
  }

  private static void copyExtensionField(
      final Map<String, Object> fullMap,
      final Map<String, Object> doc,
      final PatchProjectionSpec spec) {
    final Object rawExtension = fullMap.get(EXTENSION_KEY);
    if (!spec.replaceWholeExtension()
        && !spec.touchedExtensionKeys().isEmpty()
        && rawExtension instanceof Map<?, ?> extensionMap) {
      final Map<String, Object> filtered =
          filterExtensionEntries(extensionMap, spec.touchedExtensionKeys());
      if (!filtered.isEmpty()) {
        doc.put(EXTENSION_KEY, filtered);
      }
    } else {
      putIfPresent(doc, EXTENSION_KEY, rawExtension);
    }
  }

  private static Map<String, Object> filterExtensionEntries(
      final Map<?, ?> extensionMap, final Set<String> touchedKeys) {
    final Map<String, Object> filtered = new LinkedHashMap<>();
    for (final String key : touchedKeys) {
      final Object value = extensionMap.get(key);
      if (value != null) {
        filtered.put(key, value);
      }
    }
    return filtered;
  }

  private static void appendConfirmationMetadata(
      final Map<String, Object> doc,
      final EntityInterface<?> entity,
      final EventType changeType,
      final List<String> changed) {
    if (entity != null) {
      putIfPresent(doc, VERSION_KEY, entity.getVersion());
      putIfPresent(doc, UPDATED_AT_KEY, entity.getUpdatedAt());
    }
    doc.put(OPERATION_KEY, EventType.ENTITY_CREATED.equals(changeType) ? CREATED : UPDATED);
    if (!changed.isEmpty()) {
      doc.put(CHANGED_KEY, changed);
    }
  }

  private static String resolveEntityType(
      final EntityInterface<?> entity, final String explicitEntityType) {
    if (!nullOrEmpty(explicitEntityType)) {
      return explicitEntityType;
    }
    final String registered = entity == null ? null : Entity.getEntityTypeFromObject(entity);
    if (!nullOrEmpty(registered)) {
      return registered;
    }
    return entity == null ? null : fallbackEntityTypeFromClass(entity.getClass());
  }

  private static String fallbackEntityTypeFromClass(final Class<?> entityClass) {
    final String simpleName = entityClass.getSimpleName();
    return entityClass.isSynthetic() || simpleName.isEmpty()
        ? null
        : Character.toLowerCase(simpleName.charAt(0)) + simpleName.substring(1);
  }

  private static List<String> effectiveChangedFields(
      final EntityInterface<?> entity, final EventType changeType) {
    return entity == null || EventType.ENTITY_NO_CHANGE.equals(changeType)
        ? List.of()
        : changedFields(entity.getChangeDescription());
  }

  private static List<String> changedFields(final ChangeDescription change) {
    final Set<String> names = new LinkedHashSet<>();
    if (change != null) {
      collectNames(change.getFieldsAdded(), names);
      collectNames(change.getFieldsUpdated(), names);
      collectNames(change.getFieldsDeleted(), names);
    }
    return new ArrayList<>(names);
  }

  private static void collectNames(final List<FieldChange> changes, final Set<String> names) {
    if (changes != null) {
      changes.stream().map(FieldChange::getName).filter(Objects::nonNull).forEach(names::add);
    }
  }

  private static void putIfPresent(
      final Map<String, Object> target, final String key, final Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }
}
