package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
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

  private McpResponseUtils() {}

  /**
   * Returns {@code entity} with the secrets the REST resource masks replaced by the mask, so an MCP
   * response or change event never carries a credential the REST API would hide. Workflow
   * definitions hold sink credentials in a free-form {@code sinkConfig} that the generic entity read
   * returns in clear, and services their connection config as stored; every other entity type is
   * returned as is.
   */
  public static EntityInterface<?> maskSecrets(EntityInterface<?> entity) {
    // MCP tools read and write entities by a runtime entityType string, so the concrete type is
    // only known from the instance.
    EntityInterface<?> masked = entity;
    if (entity instanceof WorkflowDefinition definition) {
      masked = WorkflowDefinitionMasker.mask(definition);
    } else if (entity instanceof ServiceEntityInterface service
        && service.getConnection() != null
        // TestSuite implements ServiceEntityInterface with a placeholder connection and has no
        // service repository; it holds nothing to mask.
        && Entity.getEntityRepository(Entity.getEntityTypeFromObject(service))
            instanceof ServiceEntityRepository<?, ?> repository) {
      masked = maskConnection(service, repository.getServiceType());
    }
    return masked;
  }

  /**
   * The mask ServiceEntityResource applies for a non-bot caller, on a copy so the entity the
   * repository returned keeps its config. MCP masks for bots too: REST hands a bot the decrypted
   * config, and no agent task needs it. REST decrypts before masking; masking the stored config
   * gives the same result, since encryption and the masker walk the same {@code @PasswordField}
   * getters, without a secrets manager call per read.
   */
  private static ServiceEntityInterface maskConnection(
      ServiceEntityInterface service, ServiceType serviceType) {
    ServiceEntityInterface masked = JsonUtils.deepCopy(service, service.getClass());
    masked
        .getConnection()
        .setConfig(
            EntityMaskerFactory.getEntityMasker()
                .maskServiceConnectionConfig(
                    masked.getConnection().getConfig(),
                    masked.getServiceType().value(),
                    serviceType));
    return masked;
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
