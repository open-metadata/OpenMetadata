package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;

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
  private static final Set<String> RESTRICTED_FIELDS =
      Set.of(PROFILE_FIELD, TableRepository.CUSTOM_METRICS);

  /**
   * A column search loads its table with every table field for {@code *}, which fills in each
   * column's tags, custom metrics and extension, but not its profile.
   */
  private static final List<String> SEARCH_WILDCARD_FIELDS =
      List.of(Entity.FIELD_TAGS, TableRepository.CUSTOM_METRICS, Entity.FIELD_EXTENSION);

  private ColumnFieldAccess() {}

  /**
   * {@code fieldsParam} for a column read, without the fields the caller may not read on {@code
   * table}. These reads match requested fields by substring, so {@code *} returns no column field
   * and is left out.
   */
  public static String readableFields(
      ViewPermissionFilter viewFilter,
      SecurityContext securityContext,
      ResourceContextInterface table,
      String fieldsParam) {
    return readable(viewFilter, securityContext, table, fieldsParam, List.of());
  }

  /**
   * {@code fieldsParam} for a column search, without the fields the caller may not read on {@code
   * table}. {@code *} is read as the column fields the search returns for it.
   */
  public static String readableSearchFields(
      ViewPermissionFilter viewFilter,
      SecurityContext securityContext,
      ResourceContextInterface table,
      String fieldsParam) {
    return readable(viewFilter, securityContext, table, fieldsParam, SEARCH_WILDCARD_FIELDS);
  }

  private static String readable(
      ViewPermissionFilter viewFilter,
      SecurityContext securityContext,
      ResourceContextInterface table,
      String fieldsParam,
      List<String> wildcardFields) {
    if (nullOrEmpty(fieldsParam)) {
      return fieldsParam;
    }
    return Arrays.stream(fieldsParam.split(FIELD_SEPARATOR))
        .map(String::trim)
        .flatMap(field -> ALL_FIELDS.equals(field) ? wildcardFields.stream() : Stream.of(field))
        .distinct()
        .filter(field -> mayRead(viewFilter, securityContext, table, field))
        .collect(Collectors.joining(FIELD_SEPARATOR));
  }

  /**
   * Column enrichment matches requested fields by substring, so a field that merely contains a
   * restricted name is held to that name's operation too.
   */
  private static boolean mayRead(
      ViewPermissionFilter viewFilter,
      SecurityContext securityContext,
      ResourceContextInterface table,
      String field) {
    return RESTRICTED_FIELDS.stream()
        .filter(field::contains)
        .allMatch(
            restricted ->
                viewFilter.isPermitted(
                    securityContext, Entity.TABLE, operationsFor(restricted), table));
  }

  private static List<MetadataOperation> operationsFor(String field) {
    // A column's profile has no table field of the same name; shared fields use the table's map.
    return PROFILE_FIELD.equals(field)
        ? List.of(MetadataOperation.VIEW_DATA_PROFILE)
        : ViewOperations.forFields(Entity.TABLE, new Fields(Set.of(field)));
  }
}
