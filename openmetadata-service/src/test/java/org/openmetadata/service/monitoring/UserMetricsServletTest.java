package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.Response;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.DailyActiveUsers;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.ResultList;

@ExtendWith(MockitoExtension.class)
class UserMetricsServletTest {

  @Mock private UserRepository userRepository;
  @Mock private SearchRepository searchRepository;
  @Mock private CollectionDAO.UserDAO userDAO;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private Response searchResponse;

  private UserMetricsServlet servlet;
  private StringWriter stringWriter;
  private final ObjectMapper objectMapper = JsonUtils.getObjectMapper();

  @BeforeEach
  void setUp() throws Exception {
    servlet = new UserMetricsServlet();
    stringWriter = new StringWriter();
    PrintWriter writer = new PrintWriter(stringWriter);

    when(response.getWriter()).thenReturn(writer);
    when(userRepository.getDao()).thenReturn(userDAO);
  }

  @Test
  void testGetUserMetricsSuccess() throws Exception {
    // Mock the Entity static methods
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      servlet.init();

      // Setup total users count
      when(userDAO.listCount(any(ListFilter.class))).thenReturn(10, 3); // 10 total, 3 bots

      // Setup daily active users
      DailyActiveUsers dailyActiveUsers = new DailyActiveUsers();
      dailyActiveUsers.setActiveUsers(5);
      dailyActiveUsers.setTimestamp(System.currentTimeMillis());

      ResultList<DailyActiveUsers> dauResults = new ResultList<>();
      dauResults.setData(Collections.singletonList(dailyActiveUsers));

      when(searchResponse.getStatus()).thenReturn(200);
      when(searchResponse.getEntity()).thenReturn(dauResults);
      when(searchRepository.listDataInsightChartResult(
              any(Long.class),
              any(Long.class),
              any(),
              any(),
              eq(DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS),
              anyInt(),
              anyInt(),
              any(),
              any()))
          .thenReturn(searchResponse);

      // Setup last activity using the new DAO method
      long lastActivityTime = System.currentTimeMillis() - 3600000; // 1 hour ago
      when(userDAO.getMaxLastActivityTime()).thenReturn(lastActivityTime);
      servlet.doGet(request, response);
      verify(response).setStatus(HttpServletResponse.SC_OK);
      verify(response).setContentType("application/json; charset=utf-8");
      String jsonResponse = stringWriter.toString();
      @SuppressWarnings("unchecked")
      Map<String, Object> metrics = objectMapper.readValue(jsonResponse, Map.class);

      assertEquals(10, metrics.get("total_users"));
      assertEquals(3, metrics.get("bot_users"));
      assertEquals(5, metrics.get("daily_active_users"));
      assertEquals(Instant.ofEpochMilli(lastActivityTime).toString(), metrics.get("last_activity"));
    }
  }

  @Test
  void testGetUserMetricsNoDailyActiveUsers() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      servlet.init();

      // Setup counts
      when(userDAO.listCount(any(ListFilter.class))).thenReturn(8, 2);

      // No daily active users data
      when(searchResponse.getStatus()).thenReturn(200);
      when(searchResponse.getEntity()).thenReturn(new ResultList<>());
      when(searchRepository.listDataInsightChartResult(
              any(Long.class),
              any(Long.class),
              any(),
              any(),
              any(),
              anyInt(),
              anyInt(),
              any(),
              any()))
          .thenReturn(searchResponse);

      // No users with activity
      when(userDAO.getMaxLastActivityTime()).thenReturn(null);

      servlet.doGet(request, response);

      String jsonResponse = stringWriter.toString();
      @SuppressWarnings("unchecked")
      Map<String, Object> metrics = objectMapper.readValue(jsonResponse, Map.class);

      assertEquals(8, metrics.get("total_users"));
      assertEquals(2, metrics.get("bot_users"));
      assertEquals(0, metrics.get("daily_active_users"));
      assertNull(metrics.get("last_activity"));
    }
  }

  @Test
  void testGetUserMetricsError() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      servlet.init();
      when(userDAO.listCount(any(ListFilter.class)))
          .thenThrow(new RuntimeException("Database error"));

      servlet.doGet(request, response);
      verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
      String jsonResponse = stringWriter.toString();
      @SuppressWarnings("unchecked")
      Map<String, Object> error = objectMapper.readValue(jsonResponse, Map.class);

      assertEquals("Failed to collect user metrics", error.get("error"));
    }
  }

  @Test
  void testGetUserMetricsWithMultipleUsers() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      servlet.init();

      when(userDAO.listCount(any(ListFilter.class))).thenReturn(15, 5);

      DailyActiveUsers dau1 = new DailyActiveUsers();
      dau1.setActiveUsers(3);
      dau1.setTimestamp(System.currentTimeMillis() - 86400000);

      DailyActiveUsers dau2 = new DailyActiveUsers();
      dau2.setActiveUsers(7);
      dau2.setTimestamp(System.currentTimeMillis());

      ResultList<DailyActiveUsers> dauResults = new ResultList<>();
      dauResults.setData(Arrays.asList(dau1, dau2));

      when(searchResponse.getStatus()).thenReturn(200);
      when(searchResponse.getEntity()).thenReturn(dauResults);
      when(searchRepository.listDataInsightChartResult(
              any(Long.class),
              any(Long.class),
              any(),
              any(),
              any(),
              anyInt(),
              anyInt(),
              any(),
              any()))
          .thenReturn(searchResponse);

      // Setup users with different activity times
      long now = System.currentTimeMillis();
      // The DAO method should return the max activity time from non-bot users only
      // In this case, user2 has the most recent activity (1 hour ago)
      when(userDAO.getMaxLastActivityTime()).thenReturn(now - 3600000);

      servlet.doGet(request, response);

      String jsonResponse = stringWriter.toString();
      @SuppressWarnings("unchecked")
      Map<String, Object> metrics = objectMapper.readValue(jsonResponse, Map.class);

      assertEquals(15, metrics.get("total_users"));
      assertEquals(5, metrics.get("bot_users"));
      assertEquals(7, metrics.get("daily_active_users")); // Should use the latest value
      assertEquals(
          Instant.ofEpochMilli(now - 3600000).toString(),
          metrics.get("last_activity")); // Most recent non-bot activity
    }
  }
}
