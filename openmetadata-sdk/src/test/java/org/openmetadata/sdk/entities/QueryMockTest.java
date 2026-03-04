package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.QueryService;

/**
 * Mock tests for Query entity operations.
 */
public class QueryMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private QueryService mockQueryService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.queries()).thenReturn(mockQueryService);
    org.openmetadata.sdk.entities.Query.setDefaultClient(mockClient);
  }

  @Test
  void testCreateQuery() {
    // Arrange
    CreateQuery createRequest = new CreateQuery();
    createRequest.setName("daily-revenue-report");
    createRequest.setQuery("SELECT date, SUM(revenue) FROM sales GROUP BY date");
    createRequest.setDisplayName("Daily Revenue Report");
    createRequest.setDescription("Aggregates daily revenue from sales table");

    Query expectedQuery = new Query();
    expectedQuery.setId(UUID.randomUUID());
    expectedQuery.setName("daily-revenue-report");
    expectedQuery.setQuery("SELECT date, SUM(revenue) FROM sales GROUP BY date");
    expectedQuery.setFullyQualifiedName("queries.daily-revenue-report");

    when(mockQueryService.create(any(CreateQuery.class))).thenReturn(expectedQuery);

    // Act
    Query result = org.openmetadata.sdk.entities.Query.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("daily-revenue-report", result.getName());
    assertEquals("SELECT date, SUM(revenue) FROM sales GROUP BY date", result.getQuery());
    verify(mockQueryService).create(any(CreateQuery.class));
  }

  @Test
  void testRetrieveQuery() {
    // Arrange
    String queryId = UUID.randomUUID().toString();
    Query expectedQuery = new Query();
    expectedQuery.setId(UUID.fromString(queryId));
    expectedQuery.setName("user-analytics-query");
    expectedQuery.setQuery("SELECT user_id, COUNT(*) as actions FROM events GROUP BY user_id");
    expectedQuery.setDuration(1250.0); // milliseconds

    when(mockQueryService.get(queryId)).thenReturn(expectedQuery);

    // Act
    Query result = org.openmetadata.sdk.entities.Query.retrieve(queryId);

    // Assert
    assertNotNull(result);
    assertEquals(queryId, result.getId().toString());
    assertEquals("user-analytics-query", result.getName());
    assertEquals(1250.0, result.getDuration());
    verify(mockQueryService).get(queryId);
  }

  @Test
  void testRetrieveQueryWithUsers() {
    // Arrange
    String queryId = UUID.randomUUID().toString();
    String fields = "users,queryUsedIn,tags";
    Query expectedQuery = new Query();
    expectedQuery.setId(UUID.fromString(queryId));
    expectedQuery.setName("complex-join-query");

    // Mock users who run this query
    EntityReference user1 = new EntityReference();
    user1.setName("analyst1");
    user1.setType("user");
    EntityReference user2 = new EntityReference();
    user2.setName("data-scientist");
    user2.setType("user");
    expectedQuery.setUsers(List.of(user1, user2));

    when(mockQueryService.get(queryId, fields)).thenReturn(expectedQuery);

    // Act
    Query result = org.openmetadata.sdk.entities.Query.retrieve(queryId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getUsers());
    assertEquals(2, result.getUsers().size());
    assertEquals("analyst1", result.getUsers().get(0).getName());
    verify(mockQueryService).get(queryId, fields);
  }

  @Test
  void testRetrieveQueryByName() {
    // Arrange
    String fqn = "queries.kpi-dashboard.monthly-metrics";
    Query expectedQuery = new Query();
    expectedQuery.setName("monthly-metrics");
    expectedQuery.setFullyQualifiedName(fqn);
    // expectedQuery.setVotes(15); // Votes is a complex type, not int

    when(mockQueryService.getByName(fqn)).thenReturn(expectedQuery);

    // Act
    Query result = org.openmetadata.sdk.entities.Query.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    // assertEquals(15, result.getVotes()); // Votes is a complex type
    verify(mockQueryService).getByName(fqn);
  }

  @Test
  void testUpdateQuery() {
    // Arrange
    Query queryToUpdate = new Query();
    queryToUpdate.setId(UUID.randomUUID());
    queryToUpdate.setName("optimized-query");
    queryToUpdate.setDescription("Updated with performance optimizations");
    queryToUpdate.setQuery("SELECT /*+ INDEX(t1 idx1) */ * FROM t1 JOIN t2");

    // Add tags
    TagLabel tag = new TagLabel();
    tag.setTagFQN("Performance.Optimized");
    queryToUpdate.setTags(List.of(tag));

    Query expectedQuery = new Query();
    expectedQuery.setId(queryToUpdate.getId());
    expectedQuery.setName(queryToUpdate.getName());
    expectedQuery.setDescription(queryToUpdate.getDescription());
    expectedQuery.setQuery(queryToUpdate.getQuery());
    expectedQuery.setTags(queryToUpdate.getTags());

    when(mockQueryService.update(queryToUpdate.getId().toString(), queryToUpdate))
        .thenReturn(expectedQuery);

    // Act
    Query result =
        org.openmetadata.sdk.entities.Query.update(queryToUpdate.getId().toString(), queryToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated with performance optimizations", result.getDescription());
    assertNotNull(result.getTags());
    assertEquals("Performance.Optimized", result.getTags().get(0).getTagFQN());
    verify(mockQueryService).update(queryToUpdate.getId().toString(), queryToUpdate);
  }

  @Test
  void testQueryWithQueryUsedIn() {
    // Arrange
    String queryId = UUID.randomUUID().toString();
    Query expectedQuery = new Query();
    expectedQuery.setId(UUID.fromString(queryId));
    expectedQuery.setName("base-metrics-query");

    // Mock dashboards/reports using this query
    EntityReference dashboard = new EntityReference();
    dashboard.setName("executive-dashboard");
    dashboard.setType("dashboard");
    expectedQuery.setQueryUsedIn(List.of(dashboard));

    when(mockQueryService.get(queryId, "queryUsedIn")).thenReturn(expectedQuery);

    // Act
    Query result = org.openmetadata.sdk.entities.Query.retrieve(queryId, "queryUsedIn");

    // Assert
    assertNotNull(result.getQueryUsedIn());
    assertEquals(1, result.getQueryUsedIn().size());
    assertEquals("executive-dashboard", result.getQueryUsedIn().get(0).getName());
    verify(mockQueryService).get(queryId, "queryUsedIn");
  }

  @Test
  void testDeleteQuery() {
    // Arrange
    String queryId = UUID.randomUUID().toString();
    doNothing().when(mockQueryService).delete(eq(queryId), any());

    // Act
    org.openmetadata.sdk.entities.Query.delete(queryId);

    // Assert
    verify(mockQueryService).delete(eq(queryId), any());
  }

  @Test
  void testDeleteQueryWithOptions() {
    // Arrange
    String queryId = UUID.randomUUID().toString();
    doNothing().when(mockQueryService).delete(eq(queryId), any());

    // Act
    org.openmetadata.sdk.entities.Query.delete(queryId, true, true);

    // Assert
    verify(mockQueryService)
        .delete(
            eq(queryId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }
}
