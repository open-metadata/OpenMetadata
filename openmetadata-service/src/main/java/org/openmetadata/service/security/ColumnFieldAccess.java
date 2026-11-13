package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/**
 * The fields a read of a table's columns returns to the caller. A column's profile is profiler data
 * and its custom metrics are test definitions, which the table's own reads give only to callers
 * holding ViewDataProfile and ViewTests. A column read leaves such a field out for a caller without
 * that operation and still returns the columns
 * (ADR:2026-11-12-a-column-read-leaves-out-fields-the-caller-may-not-view).
 */
public final class ColumnFieldAccess {
  public static final String PROFILE_FIELD = "profile";
  private static final String FIELD_SEPARATOR = ",";
  private static final String ALL_FIELDS = "*";
  private static final Map<String, MetadataOperation> RESTRICTED_FIELDS =
      Map.of(
          PROFILE_FIELD,
          MetadataOperation.VIEW_DATA_PROFILE,
          TableRepository.CUSTOM_METRICS,
          MetadataOperation.VIEW_TESTS);

  private ColumnFieldAccess() {}

  /** {@code fieldsParam} without the fields the caller may not read on {@code table}. */
  public static String readableFields(
      ViewPermissionFilter viewFilter,
      SecurityContext securityContext,
      ResourceContextInterface table,
      String fieldsParam) {
    if (nullOrEmpty(fieldsParam)) {
      return fieldsParam;
    }
    return Arrays.stream(fieldsParam.split(FIELD_SEPARATOR))
        .map(String::trim)
        .filter(field -> mayRead(viewFilter, securityContext, table, field))
        .collect(Collectors.joining(FIELD_SEPARATOR));
  }

  /**
   * Column enrichment matches requested fields by substring, so a field that merely contains a
   * restricted name is held to that name's operation too, and the wildcard to every one of them.
   */
  private static boolean mayRead(
      ViewPermissionFilter viewFilter,
      SecurityContext securityContext,
      ResourceContextInterface table,
      String field) {
    return RESTRICTED_FIELDS.entrySet().stream()
        .filter(restricted -> ALL_FIELDS.equals(field) || field.contains(restricted.getKey()))
        .allMatch(
            restricted ->
                viewFilter.isPermitted(
                    securityContext, Entity.TABLE, List.of(restricted.getValue()), table));
  }
}
