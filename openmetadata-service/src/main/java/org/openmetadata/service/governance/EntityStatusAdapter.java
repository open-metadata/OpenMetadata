package org.openmetadata.service.governance;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.EntityInterface;

/** Converts a policy's generated enum to wire codes at shared lifecycle boundaries. */
public record EntityStatusAdapter<S extends Enum<S>>(Class<S> statusType) {
  public EntityStatusAdapter {
    Objects.requireNonNull(statusType, "A lifecycle requires its generated status enum");
    if (!statusType.isEnum()) {
      throw new IllegalArgumentException("Lifecycle status must be an enum: " + statusType);
    }
  }

  public List<S> statuses() {
    return List.of(statusType.getEnumConstants());
  }

  public List<String> codes() {
    return statuses().stream().map(this::code).toList();
  }

  public String code(Enum<?> status) {
    return status == null ? null : statusType.cast(status).toString();
  }

  public S resolve(String code) {
    String normalized = code == null ? "" : code.trim();
    return Arrays.stream(statusType.getEnumConstants())
        .filter(status -> status.toString().equalsIgnoreCase(normalized))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Unknown " + statusType.getSimpleName() + " value: " + code));
  }

  public String read(EntityInterface<?> entity) {
    return code(entity.getEntityStatus());
  }

  public void write(EntityInterface<?> entity, String code) {
    requireEntityType(entity.getClass());
    writeChecked(entity, code == null ? null : resolve(code));
  }

  public void requireEntityType(Class<?> entityType) {
    try {
      Class<?> declaredStatus = entityType.getMethod("getEntityStatus").getReturnType();
      if (!statusType.equals(declaredStatus)) {
        throw new IllegalArgumentException(
            entityType.getSimpleName()
                + " declares "
                + declaredStatus.getSimpleName()
                + ", but its lifecycle uses "
                + statusType.getSimpleName());
      }
    } catch (NoSuchMethodException exception) {
      throw new IllegalArgumentException(
          "Entity has no lifecycle status: " + entityType, exception);
    }
  }

  public static EntityStatusAdapter<?> forEntityType(Class<?> entityType) {
    try {
      return forStatusType(entityType.getMethod("getEntityStatus").getReturnType());
    } catch (NoSuchMethodException exception) {
      throw new IllegalArgumentException(
          "Entity has no lifecycle status: " + entityType, exception);
    }
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private static EntityStatusAdapter<?> forStatusType(Class<?> statusType) {
    if (!statusType.isEnum()) {
      throw new IllegalArgumentException("Entity has no declared status enum: " + statusType);
    }
    return new EntityStatusAdapter((Class<? extends Enum>) statusType);
  }

  // The generated getter's return type is checked before crossing the heterogeneous entity
  // boundary.
  @SuppressWarnings("unchecked")
  private void writeChecked(EntityInterface<?> entity, S status) {
    ((EntityInterface<S>) entity).setEntityStatus(status);
  }
}
