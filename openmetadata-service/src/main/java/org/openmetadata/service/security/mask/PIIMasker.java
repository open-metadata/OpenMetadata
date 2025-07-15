package org.openmetadata.service.security.mask;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.TopicRepository.getAllFieldTags;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ColumnUtil;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;

public class PIIMasker {
  public static final String SENSITIVE_PII_TAG = "PII.Sensitive";
  public static final String MASKED_VALUE = "********";
  public static final String MASKED_NAME = "[MASKED]";
  public static final String MASKED_MAIL = "********@masked.com";

  private PIIMasker() {
    /* Private constructor for Utility class */
  }

  public static TableData maskSampleData(TableData sampleData, Table table, List<Column> columns) {
    // If we don't have sample data, there's nothing to do
    if (sampleData == null) {
      return null;
    }

    List<Integer> columnsPositionToBeMasked;

    // If the table itself is marked as PII, mask all the sample data
    if (hasPiiSensitiveTag(table)) {
      columnsPositionToBeMasked =
          IntStream.range(0, columns.size()).boxed().collect(Collectors.toList());
    } else {
      // Otherwise, mask only the PII columns
      columnsPositionToBeMasked =
          columns.stream()
              .collect(
                  Collectors.toMap(
                      Function.identity(), c -> sampleData.getColumns().indexOf(c.getName())))
              .entrySet()
              .stream()
              .filter(entry -> hasPiiSensitiveTag(entry.getKey()))
              .map(Map.Entry::getValue)
              .collect(Collectors.toList());
    }

    // Mask rows
    sampleData.setRows(
        sampleData.getRows().stream()
            .map(r -> maskSampleDataRow(r, columnsPositionToBeMasked))
            .collect(Collectors.toList()));

    List<String> sampleDataColumns = sampleData.getColumns();

    // Flag column names as masked
    columnsPositionToBeMasked.forEach(
        position ->
            sampleDataColumns.set(position, flagMaskedName(sampleDataColumns.get(position))));

    return sampleData;
  }

  public static Table getSampleData(Table table) {
    TableData sampleData = maskSampleData(table.getSampleData(), table, table.getColumns());
    table.setSampleData(sampleData);
    return table;
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

  public static List<Column> getTableProfile(List<Column> columns) {
    for (Column column : listOrEmpty(columns)) {
      if (hasPiiSensitiveTag(column)) {
        column.setProfile(null);
        column.setName(flagMaskedName(column.getName()));
      }
    }
    return columns;
  }

  public static List<ColumnProfile> getColumnProfile(
      String fqn, List<ColumnProfile> columnProfiles) {
    Table table =
        Entity.getEntityByName(
            Entity.TABLE, FullyQualifiedName.getTableFQN(fqn), "columns,tags", Include.ALL);
    Column column =
        table.getColumns().stream()
            .filter(c -> c.getFullyQualifiedName().equals(fqn))
            .findFirst()
            .orElse(null);
    if (column != null && hasPiiSensitiveTag(column)) {
      return Collections.nCopies(columnProfiles.size(), new ColumnProfile());
    }
    return columnProfiles;
  }

  private static TestCase getTestCase(Column column, TestCase testCase) {
    if (!hasPiiSensitiveTag(column)) return testCase;

    testCase.setTestCaseResult(null);
    testCase.setParameterValues(null);
    testCase.setDescription(null);
    testCase.setName(flagMaskedName(testCase.getName()));

    return testCase;
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
                    table =
                        Entity.getEntityByName(
                            Entity.TABLE,
                            testCaseLink.getEntityFQN(),
                            "owners,tags,columns",
                            Include.ALL);
                    entityFQNToTable.put(testCaseLink.getEntityFQN(), table);
                  }

                  // Ignore table tests
                  if (testCaseLink.getFieldName() == null) return testCase;

                  Optional<Column> referencedColumn =
                      table.getColumns().stream()
                          .filter(
                              col ->
                                  testCaseLink
                                      .getFullyQualifiedFieldValue()
                                      .equals(col.getFullyQualifiedName()))
                          .findFirst();

                  if (referencedColumn.isPresent()) {
                    Column col = referencedColumn.get();
                    // We need the table owner to know if we can authorize the access
                    boolean authorizePII =
                        authorizer.authorizePII(securityContext, table.getOwners());
                    if (!authorizePII) return PIIMasker.getTestCase(col, testCase);
                    return testCase;
                  }
                  return testCase;
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
            .map(
                query -> {
                  boolean authorizePII =
                      authorizer.authorizePII(securityContext, query.getOwners());
                  if (!authorizePII) return PIIMasker.getQuery(query);
                  return query;
                })
            .collect(Collectors.toList());
    queries.setData(maskedQueries);
    return queries;
  }

  private static boolean hasPiiSensitiveTag(Query query) {
    return query.getTags().stream().map(TagLabel::getTagFQN).anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(Column column) {
    return ColumnUtil.getAllTags(column).stream().anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(Table table) {
    return table.getTags().stream().map(TagLabel::getTagFQN).anyMatch(SENSITIVE_PII_TAG::equals);
  }

  private static boolean hasPiiSensitiveTag(SearchIndex searchIndex) {
    return searchIndex.getTags().stream()
        .map(TagLabel::getTagFQN)
        .anyMatch(SENSITIVE_PII_TAG::equals);
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

  private static String flagMaskedName(String name) {
    return String.format("%s %s", name, MASKED_NAME);
  }

  public static User maskUser(Authorizer authorizer, SecurityContext securityContext, User user) {
    if (authorizer.authorizePII(securityContext, null)) return user;
    user.setEmail(MASKED_MAIL);
    return user;
  }
}
