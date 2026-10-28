package org.openmetadata.service.security.mask;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.TopicRepository.getAllFieldTags;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ColumnUtil;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PIIMasker {
  private static final Logger LOG = LoggerFactory.getLogger(PIIMasker.class);
  public static final String SENSITIVE_PII_TAG = "PII.Sensitive";
  public static final String MASKED_VALUE = "********";
  public static final String MASKED_NAME = "[MASKED]";
  public static final String MASKED_MAIL = "********@masked.com";

  private PIIMasker() {
    /* Private constructor for Utility class */
  }

  public static TableData maskSampleData(TableData sampleData, Table table, List<Column> columns) {
    return maskSampleDataInternal(sampleData, columns, hasPiiSensitiveTag(table));
  }

  public static TableData maskSampleData(
      TableData sampleData, Container container, List<Column> columns) {
    return maskSampleDataInternal(sampleData, columns, hasPiiSensitiveTag(container));
  }

  private static TableData maskSampleDataInternal(
      TableData sampleData, List<Column> columns, boolean entityHasPiiTag) {
    // If we don't have sample data, there's nothing to do
    if (sampleData == null) {
      return null;
    }

    List<Integer> columnsPositionToBeMasked;

    // Positions index the sample's own columns, which may be a subset of the entity's columns, in
    // any order, and (for failed-row samples, validated case-insensitively) in a different case.
    // An entity-level PII tag masks every sampled column; otherwise a sampled column is masked when
    // its name matches a PII column ignoring case.
    List<String> sampledColumns = sampleData.getColumns();
    if (entityHasPiiTag) {
      columnsPositionToBeMasked =
          IntStream.range(0, sampledColumns.size()).boxed().collect(Collectors.toList());
    } else {
      Set<String> piiColumnNames =
          columns.stream()
              .filter(column -> hasPiiSensitiveTag(column))
              .map(column -> column.getName().toLowerCase(Locale.ROOT))
              .collect(Collectors.toSet());
      columnsPositionToBeMasked =
          IntStream.range(0, sampledColumns.size())
              .filter(position -> isPiiColumnName(sampledColumns.get(position), piiColumnNames))
              .boxed()
              .collect(Collectors.toList());
    }

    // Mask rows
    sampleData.setRows(
        sampleData.getRows().stream()
            .map(r -> maskSampleDataRow(r, columnsPositionToBeMasked))
            .collect(Collectors.toList()));

    // Flag column names as masked
    columnsPositionToBeMasked.forEach(
        position -> sampledColumns.set(position, flagMaskedName(sampledColumns.get(position))));

    return sampleData;
  }

  private static boolean isPiiColumnName(String sampledColumn, Set<String> piiColumnNames) {
    return sampledColumn != null && piiColumnNames.contains(sampledColumn.toLowerCase(Locale.ROOT));
  }

  public static Table getSampleData(Table table) {
    TableData sampleData = maskSampleData(table.getSampleData(), table, table.getColumns());
    table.setSampleData(sampleData);
    return table;
  }

  public static Container getSampleData(Container container) {
    if (container.getDataModel() != null && container.getDataModel().getColumns() != null) {
      TableData sampleData =
          maskSampleData(
              container.getSampleData(), container, container.getDataModel().getColumns());
      container.setSampleData(sampleData);
    }
    return container;
  }

  /*
  If the topic or any of its fields are flagged as PII, we will
  mask the full TopicSampleData list of messages, since we cannot
  easily pick up the specific key containing the sample data.
  */
  public static Topic getSampleData(Topic topic) {
    TopicSampleData sampleData = topic.getSampleData();

    // If we don't have sample data, there's nothing to do
    if (sampleData == null) {
      return topic;
    }

    if (hasPiiSensitiveTag(topic)) {
      sampleData.setMessages(List.of(MASKED_VALUE));
      topic.setSampleData(sampleData);
    }

    return topic;
  }

  public static SearchIndex getSampleData(SearchIndex searchIndex) {
    SearchIndexSampleData sampleData = searchIndex.getSampleData();

    // If we don't have sample data, there's nothing to do
    if (sampleData == null) {
      return searchIndex;
    }

    if (hasPiiSensitiveTag(searchIndex)) {
      sampleData.setMessages(List.of(MASKED_VALUE));
      searchIndex.setSampleData(sampleData);
    }

    return searchIndex;
  }

  public static List<Column> getTableProfile(
      String fqn, List<Column> columns, Authorizer authorizer, SecurityContext securityContext) {
    Table table = Entity.getEntityByName(Entity.TABLE, fqn, "owners", Include.ALL);
    return getTableProfile(table.getOwners(), columns, authorizer, securityContext);
  }

  public static List<Column> getTableProfile(
      List<EntityReference> owners,
      List<Column> columns,
      Authorizer authorizer,
      SecurityContext securityContext) {
    boolean authorizePII = authorizer.authorizePII(securityContext, owners);
    if (authorizePII) return columns;
    maskColumnProfiles(columns);
    return columns;
  }

  private static void maskColumnProfiles(List<Column> columns) {
    maskNestedColumnProfiles(columns, false);
  }

  /**
   * The masking rule for a column and its children mirrors the resolved-path walk: a direct
   * {@code PII.Sensitive} tag on any ancestor covers the nested fields beneath it, while the
   * column's own tag set ({@code getAllTags}) additionally covers its whole subtree. Every nested
   * child carries a profile of its own once the repository flattens the column tree, so the walk
   * must not stop at the top level.
   */
  private static void maskNestedColumnProfiles(List<Column> columns, boolean ancestorSensitive) {
    for (Column column : listOrEmpty(columns)) {
      boolean masked = ancestorSensitive || hasPiiSensitiveTag(column);
      if (masked) {
        column.setProfile(null);
        column.setName(flagMaskedName(column.getName()));
      }
      maskNestedColumnProfiles(
          column.getChildren(), ancestorSensitive || hasDirectPiiSensitiveTag(column));
    }
  }

  public static List<ColumnProfile> getColumnProfile(
      String fqn,
      List<ColumnProfile> columnProfiles,
      Authorizer authorizer,
      SecurityContext securityContext) {
    Table table =
        Entity.getEntityByName(
            Entity.TABLE, FullyQualifiedName.getTableFQN(fqn), "columns,tags,owners", Include.ALL);
    boolean authorizePII = authorizer.authorizePII(securityContext, table.getOwners());

    if (!authorizePII && isPiiSensitiveOrUnresolvedColumn(table, fqn)) {
      return Collections.nCopies(columnProfiles.size(), new ColumnProfile());
    }
    return columnProfiles;
  }

  public static ColumnProfile maskColumnProfile(String fqn, ColumnProfile columnProfile) {
    Table table = Entity.getEntityByName(Entity.TABLE, fqn, "columns,tags", Include.ALL);
    String profileName = columnProfile.getName();
    List<Column> columnPath = ColumnUtil.resolveColumnChainByPath(table.getColumns(), profileName);

    if (isPiiSensitiveOrUnresolvedProfile(table, profileName, columnPath)) {
      return new ColumnProfile().withName(profileName);
    }
    return columnProfile;
  }

  /**
   * Whether a column FQN resolves to a PII.Sensitive column: the path is walked through nested
   * children (a top-level-only match would leave nested profiles unmasked), and a tag on any
   * column along the path covers the leaf. An unresolved FQN counts as sensitive — profile rows
   * outlive the columns they describe, so unknown names must fail closed.
   */
  private static boolean isPiiSensitiveOrUnresolvedColumn(Table table, String columnFqn) {
    List<Column> columnPath = resolveColumnPath(table, columnFqn);
    return columnPath.isEmpty() || hasPiiSensitiveTagInPath(columnPath);
  }

  /**
   * Whether a stored column profile must be masked: an unresolved column name fails closed (the
   * row outlives its column), and a dotted name a nested path shadows also covers the literal
   * top-level column it could name — when both resolve, masking follows the one that is
   * sensitive.
   */
  private static boolean isPiiSensitiveOrUnresolvedProfile(
      Table table, String profileName, List<Column> columnPath) {
    if (columnPath.isEmpty() || hasPiiSensitiveTagInPath(columnPath)) {
      return true;
    }
    if (columnPath.size() < 2) {
      return false;
    }
    Column shadowed =
        findTopLevelColumn(table.getColumns(), FullyQualifiedName.unquoteName(profileName));
    return shadowed != null && hasPiiSensitiveTag(shadowed);
  }

  private static Column findTopLevelColumn(List<Column> columns, String name) {
    return listOrEmpty(columns).stream()
        .filter(column -> column.getName().equals(name) || column.getName().equalsIgnoreCase(name))
        .findFirst()
        .orElse(null);
  }

  /** The chain of columns a column FQN resolves to, from the path relative to its table. */
  private static List<Column> resolveColumnPath(Table table, String columnFqn) {
    String tableFqn = FullyQualifiedName.getTableFQN(columnFqn);
    if (tableFqn.equals(columnFqn)) {
      return List.of();
    }
    return ColumnUtil.resolveColumnChainByPath(
        table.getColumns(), columnFqn.substring(tableFqn.length() + 1));
  }

  /**
   * Masks a column test case when the column it references is PII-tagged and the caller lacks PII
   * authorization. The reference is resolved through nested children, and tags on any column along
   * the path count: a PII-tagged parent struct covers the nested fields beneath it.
   */
  private static TestCase maskNestedTestCase(
      Table table,
      MessageParser.EntityLink testCaseLink,
      TestCase testCase,
      Authorizer authorizer,
      SecurityContext securityContext) {
    List<Column> columnPath =
        ColumnUtil.resolveColumnChainByPath(table.getColumns(), testCaseLink.getArrayFieldName());
    if (columnPath.isEmpty()) {
      return testCase;
    }
    // We need the table owner to know if we can authorize the access
    boolean authorizePII = authorizer.authorizePII(securityContext, table.getOwners());
    if (!authorizePII && hasPiiSensitiveTagInPath(columnPath)) {
      return maskTestCase(testCase);
    }
    return testCase;
  }

  private static boolean hasPiiSensitiveTagInPath(List<Column> columnPath) {
    // The leaf's tag set covers itself and its descendants (getAllTags); ancestors only their own.
    if (hasPiiSensitiveTag(columnPath.getLast())) {
      return true;
    }
    return columnPath.subList(0, columnPath.size() - 1).stream()
        .anyMatch(PIIMasker::hasDirectPiiSensitiveTag);
  }

  private static boolean hasDirectPiiSensitiveTag(Column column) {
    return listOrEmpty(column.getTags()).stream()
        .map(TagLabel::getTagFQN)
        .anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static TestCase maskTestCase(TestCase testCase) {
    testCase.setTestCaseResult(null);
    testCase.setParameterValues(null);
    testCase.setDescription(null);
    testCase.setName(flagMaskedName(testCase.getName()));

    return testCase;
  }

  /**
   * A test case outlives the table it points at: the table is hard-deleted while the test case row
   * survives until DataRetention's {@code OrphanTestCaseCleanup} sweeps it. Resolving that dangling
   * {@code entityLink} must not fail the request — a single stale row would otherwise turn every
   * listing that happens to include it into a 404.
   */
  private static Table findTableOrNull(String tableFqn) {
    Table table;
    try {
      table = Entity.getEntityByName(Entity.TABLE, tableFqn, "owners,tags,columns", Include.ALL);
    } catch (EntityNotFoundException e) {
      LOG.debug("Test case references table [{}] that no longer exists", tableFqn);
      table = null;
    }
    return table;
  }

  public static ResultList<TestCase> getTestCases(
      ResultList<TestCase> testCases, Authorizer authorizer, SecurityContext securityContext) {
    Map<String, Table> entityFQNToTable = new HashMap<>();
    List<TestCase> maskedTests =
        testCases.getData().stream()
            .map(
                testCase -> {
                  MessageParser.EntityLink testCaseLink =
                      MessageParser.EntityLink.parse(testCase.getEntityLink());
                  Table table;
                  if (entityFQNToTable.containsKey(testCaseLink.getEntityFQN())) {
                    table = entityFQNToTable.get(testCaseLink.getEntityFQN());
                  } else {
                    table = findTableOrNull(testCaseLink.getEntityFQN());
                    entityFQNToTable.put(testCaseLink.getEntityFQN(), table);
                  }

                  if (table == null) {
                    // The column tags that decide masking died with the table, so fall back to the
                    // caller's PII authorization rather than exposing the orphan's results.
                    return authorizer.authorizePII(securityContext, null)
                        ? testCase
                        : maskTestCase(testCase);
                  }

                  // Ignore table tests
                  if (testCaseLink.getFieldName() == null) return testCase;

                  return maskNestedTestCase(
                      table, testCaseLink, testCase, authorizer, securityContext);
                })
            .collect(Collectors.toList());

    testCases.setData(maskedTests);
    return testCases;
  }

  /*
  Either return the query if user has permissions, or hide it completely.
  */
  private static Query getQuery(Query query) {
    if (!hasPiiSensitiveTag(query)) return query;
    query.setQuery(MASKED_VALUE);
    return query;
  }

  public static ResultList<Query> getQueries(
      ResultList<Query> queries, Authorizer authorizer, SecurityContext securityContext) {
    List<Query> maskedQueries =
        queries.getData().stream()
            .map(query -> maskQuery(query, authorizer, securityContext))
            .collect(Collectors.toList());
    queries.setData(maskedQueries);
    return queries;
  }

  /** Masks a PII.Sensitive query's SQL unless the caller is an admin, a bot or an owner. */
  public static Query maskQuery(
      Query query, Authorizer authorizer, SecurityContext securityContext) {
    return authorizer.authorizePII(securityContext, query.getOwners()) ? query : getQuery(query);
  }

  private static boolean hasPiiSensitiveTag(Query query) {
    return listOrEmpty(query.getTags()).stream()
        .map(TagLabel::getTagFQN)
        .anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(Column column) {
    return ColumnUtil.getAllTags(column).stream().anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(Table table) {
    return table.getTags().stream().map(TagLabel::getTagFQN).anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(Container container) {
    return container.getTags() != null
        && container.getTags().stream()
            .map(TagLabel::getTagFQN)
            .anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(SearchIndex searchIndex) {
    if (searchIndex.getTags().stream().map(TagLabel::getTagFQN).anyMatch(SENSITIVE_PII_TAG::equals))
      return true;

    return listOrEmpty(searchIndex.getFields()).stream().anyMatch(PIIMasker::hasPiiSensitiveTag);
  }

  private static boolean hasPiiSensitiveTag(SearchIndexField field) {
    return listOrEmpty(field.getTags()).stream()
            .map(TagLabel::getTagFQN)
            .anyMatch(SENSITIVE_PII_TAG::equals)
        || listOrEmpty(field.getChildren()).stream().anyMatch(PIIMasker::hasPiiSensitiveTag);
  }

  /*
  Check if the Topic is flagged as PII or any of its fields
  */
  private static boolean hasPiiSensitiveTag(Topic topic) {
    if (topic.getTags().stream().map(TagLabel::getTagFQN).anyMatch(SENSITIVE_PII_TAG::equals))
      return true;

    Set<TagLabel> fieldTags = new HashSet<>();
    List<Field> schemaFields =
        topic.getMessageSchema() != null ? topic.getMessageSchema().getSchemaFields() : null;
    for (Field schemaField : listOrEmpty(schemaFields)) {
      fieldTags.addAll(getAllFieldTags(schemaField));
    }

    return fieldTags.stream().map(TagLabel::getTagFQN).anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static List<Object> maskSampleDataRow(
      List<Object> row, List<Integer> columnsPositionToBeMasked) {
    columnsPositionToBeMasked.forEach(position -> row.set(position, MASKED_VALUE));
    return row;
  }

  /**
   * Idempotency matters: column profiles masking can visit a nested column twice when the caller
   * passes the repository's flattened column list, where a node is both a child of its parent and
   * its own entry.
   */
  private static String flagMaskedName(String name) {
    if (name.endsWith(MASKED_NAME)) {
      return name;
    }
    return String.format("%s %s", name, MASKED_NAME);
  }

  public static User maskUser(Authorizer authorizer, SecurityContext securityContext, User user) {
    if (authorizer.authorizePII(securityContext, null)) return user;
    user.setEmail(MASKED_MAIL);
    return user;
  }
}
