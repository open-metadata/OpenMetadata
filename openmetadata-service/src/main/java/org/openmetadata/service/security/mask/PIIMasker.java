package org.openmetadata.service.security.mask;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.TopicRepository.getAllFieldTags;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.JsonUtils;
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
  private static final String EMAIL_FIELD = "email";

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

  public static List<Column> getSingleColumnProfile(
      String tableFqn,
      List<Column> ancestors,
      Column column,
      Authorizer authorizer,
      SecurityContext securityContext) {
    Table table = Entity.getEntityByName(Entity.TABLE, tableFqn, "owners", Include.ALL);
    return getSingleColumnProfile(
        table.getOwners(), ancestors, column, authorizer, securityContext);
  }

  /**
   * A single-column GET serialises one column, so the {@link #getTableProfile} walk cannot see a
   * {@code PII.Sensitive} tag sitting on a column above it in the tree. The caller hands the
   * ancestor chain resolved from the table's own columns, and a direct tag on any of them masks
   * this column and the subtree beneath it the way the full-tree walk would — the walk then still
   * covers the column's own tag set, as {@link #getTableProfile} does.
   */
  public static List<Column> getSingleColumnProfile(
      List<EntityReference> owners,
      List<Column> ancestors,
      Column column,
      Authorizer authorizer,
      SecurityContext securityContext) {
    boolean authorizePII = authorizer.authorizePII(securityContext, owners);
    if (authorizePII) {
      return new ArrayList<>(List.of(column));
    }
    boolean ancestorSensitive =
        listOrEmpty(ancestors).stream().anyMatch(PIIMasker::hasDirectPiiSensitiveTag);
    List<Column> columns = new ArrayList<>(List.of(column));
    maskNestedColumnProfiles(columns, ancestorSensitive);
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
    String[] parts = FullyQualifiedName.split(columnFqn);
    if (parts.length < 5) {
      return List.of();
    }
    return ColumnUtil.resolveColumnChainByPath(table.getColumns(), columnPathOf(parts));
  }

  /**
   * The dotted path of a column within its table, per FQN segment (re-quoted so a segment's own
   * dots stay inside quotes). Splitting rather than slicing the raw string keeps the path aligned
   * with how the profile rows are looked up: {@code getTableFQN} normalizes redundant quotes in
   * the table prefix, so a character offset against it can split the path mid-segment while the
   * hashed DB lookup still resolves the real column.
   */
  private static String columnPathOf(String[] parts) {
    return Arrays.stream(parts)
        .skip(4)
        .map(FullyQualifiedName::quoteName)
        .collect(Collectors.joining(Entity.SEPARATOR));
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

  public static TestCase getTestCase(
      TestCase testCase, Authorizer authorizer, SecurityContext securityContext) {
    return new TestCaseMasker(authorizer, securityContext).mask(testCase);
  }

  public static boolean shouldMaskTestCase(
      TestCase testCase, Authorizer authorizer, SecurityContext securityContext) {
    return new TestCaseMasker(authorizer, securityContext).shouldMask(testCase);
  }

  private static TestCase maskTestCase(TestCase testCase) {
    testCase.setIncidentStatus(null);
    testCase.setTestCaseResult(null);
    testCase.setParameterValues(null);
    testCase.setDescription(null);
    testCase.setChangeDescription(null);
    testCase.setIncrementalChangeDescription(null);
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
    final TestCaseMasker masker = new TestCaseMasker(authorizer, securityContext);
    testCases.setData(testCases.getData().stream().map(masker::mask).toList());
    return testCases;
  }

  public static ResultList<TestCaseResult> getTestCaseResults(
      ResultList<TestCaseResult> results, Authorizer authorizer, SecurityContext securityContext) {
    final TestCaseMasker masker = new TestCaseMasker(authorizer, securityContext);
    results.setData(results.getData().stream().map(masker::maskResult).toList());
    return results;
  }

  public static TestCaseResult getTestCaseResult(
      TestCaseResult result, Authorizer authorizer, SecurityContext securityContext) {
    return result == null
        ? null
        : new TestCaseMasker(authorizer, securityContext).maskResult(result);
  }

  static final class TestCaseMasker {
    private static final int MAX_LINKED_ENTITIES = 1000;
    private final Authorizer authorizer;
    private final SecurityContext securityContext;
    private final boolean unrestricted;
    private final Cache<String, Optional<Table>> tables =
        Caffeine.newBuilder().maximumSize(MAX_LINKED_ENTITIES).build();
    private final Cache<String, Optional<TestCase>> testCases =
        Caffeine.newBuilder().maximumSize(MAX_LINKED_ENTITIES).build();

    TestCaseMasker(Authorizer authorizer, SecurityContext securityContext) {
      this.authorizer = authorizer;
      this.securityContext = securityContext;
      this.unrestricted = authorizer.authorizePII(securityContext, null);
    }

    boolean isUnrestricted() {
      return unrestricted;
    }

    TestCase mask(TestCase testCase) {
      return shouldMask(testCase) ? maskTestCase(testCase) : testCase;
    }

    boolean shouldMask(TestCase testCase) {
      if (unrestricted) {
        return false;
      }
      if (testCase == null) {
        return true;
      }
      final MessageParser.EntityLink link =
          MessageParser.EntityLink.parse(testCase.getEntityLink());
      final Table table =
          tables
              .get(link.getEntityFQN(), fqn -> Optional.ofNullable(findTableOrNull(fqn)))
              .orElse(null);
      final boolean authorized =
          authorizer.authorizePII(securityContext, table == null ? null : table.getOwners());
      return !authorized
          && (table == null
              || (link.getFieldName() != null
                  && isSensitiveColumn(table, link.getArrayFieldName())));
    }

    private boolean isSensitiveColumn(Table table, String columnName) {
      final List<Column> path = ColumnUtil.resolveColumnChainByPath(table.getColumns(), columnName);
      return !path.isEmpty() && hasPiiSensitiveTagInPath(path);
    }

    TestCaseResult maskResult(TestCaseResult result) {
      if (unrestricted) {
        return result;
      }
      return shouldMask(findTestCase(result.getTestCaseFQN()))
          ? new TestCaseResult()
              .withId(result.getId())
              .withTestCaseFQN(result.getTestCaseFQN())
              .withTimestamp(result.getTimestamp())
          : result;
    }

    TestCase findTestCase(String fqn) {
      return fqn == null ? null : testCases.get(fqn, this::loadTestCase).orElse(null);
    }

    private Optional<TestCase> loadTestCase(String fqn) {
      try {
        return Optional.of(Entity.getEntityByName(Entity.TEST_CASE, fqn, "", Include.ALL));
      } catch (EntityNotFoundException e) {
        LOG.debug("Test result references test case [{}] that no longer exists", fqn);
        return Optional.empty();
      }
    }
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
  static String flagMaskedName(String name) {
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

  /**
   * A change event about a user carries the user's email, in its entity snapshot and in the change
   * of the email field, so it is masked as a read of the user masks it.
   */
  public static ChangeEvent maskUserChangeEvent(ChangeEvent event) {
    if (event == null || !Entity.USER.equals(event.getEntityType())) {
      return event;
    }
    event.setEntity(maskEmail(event.getEntity()));
    ChangeDescription change = event.getChangeDescription();
    if (change != null) {
      for (List<FieldChange> changes :
          List.of(
              listOrEmpty(change.getFieldsAdded()),
              listOrEmpty(change.getFieldsUpdated()),
              listOrEmpty(change.getFieldsDeleted()))) {
        for (FieldChange fieldChange : changes) {
          if (EMAIL_FIELD.equals(fieldChange.getName())) {
            fieldChange.setOldValue(fieldChange.getOldValue() == null ? null : MASKED_MAIL);
            fieldChange.setNewValue(fieldChange.getNewValue() == null ? null : MASKED_MAIL);
          }
        }
      }
    }
    return event;
  }

  // The snapshot is stored either as a JSON string or as an already-parsed object.
  private static Object maskEmail(Object entity) {
    if (entity == null) {
      return null;
    }
    JsonNode tree =
        entity instanceof String json ? JsonUtils.readTree(json) : JsonUtils.valueToTree(entity);
    if (!(tree instanceof ObjectNode object) || !object.has(EMAIL_FIELD)) {
      return entity;
    }
    object.put(EMAIL_FIELD, MASKED_MAIL);
    return entity instanceof String
        ? JsonUtils.pojoToJson(object)
        : JsonUtils.treeToValue(object, Object.class);
  }
}
