package org.openmetadata.service.jdbi3;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.service.util.jdbi.BindJsonContains;
import org.openmetadata.service.util.jdbi.JsonContainsFilterFactory;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JsonContainsFilterFactoryTest {

  @Mock private BindJsonContains annotation;
  @Mock private SqlStatement<?> statement;
  @Mock private StatementContext context;
  @Mock private Connection connection;
  @Mock private DatabaseMetaData metaData;
  @Mock private Method method;
  @Mock private Parameter parameter;

  private JsonContainsFilterFactory factory;

  @BeforeEach
  void setup() throws SQLException {
    factory = new JsonContainsFilterFactory();
    when(statement.getContext()).thenReturn(context);
    when(context.getConnection()).thenReturn(connection);
    when(connection.getMetaData()).thenReturn(metaData);

    // Default annotation values
    when(annotation.path()).thenReturn("$.stats.services");
    when(annotation.property()).thenReturn("id");
    when(annotation.value()).thenReturn("jsonFilter");
    when(annotation.ifNull()).thenReturn("TRUE");
  }

  @Test
  void testCreateForParameter_withMySql() throws SQLException {
    // Arrange
    when(metaData.getDatabaseProductName()).thenReturn("MySQL");
    String serviceId = "test-service";

    // Act
    var customizer =
        factory.createForParameter(annotation, null, method, parameter, 0, String.class);
    customizer.apply(statement, serviceId);

    // Assert
    verify(statement)
        .define(
            eq(annotation.value()),
            eq("JSON_CONTAINS(JSON_EXTRACT(json, '$.stats.services[*].id'), JSON_QUOTE(:value))"));
    verify(statement).bind(eq("value"), eq(serviceId));
  }

  @Test
  void testCreateForParameter_withPostgres() throws SQLException {
    // Arrange
    when(metaData.getDatabaseProductName()).thenReturn("PostgreSQL");
    String serviceId = "test-service";

    // Act
    var customizer =
        factory.createForParameter(annotation, null, method, parameter, 0, String.class);
    customizer.apply(statement, serviceId);

    // Assert
    verify(statement)
        .define(
            eq(annotation.value()),
            eq(
                "jsonb_path_exists(json::jsonb, '$.stats.services[*] ? (@.id == $jsonPathValue)', jsonb_build_object('jsonPathValue', :value))"));
    verify(statement).bind(eq("value"), eq(serviceId));
  }

  @Test
  void testCreateForParameter_withCustomPath() throws SQLException {
    // Arrange
    when(metaData.getDatabaseProductName()).thenReturn("MySQL");
    when(annotation.path()).thenReturn("$.custom.path");
    when(annotation.property()).thenReturn("name");
    String serviceId = "test-service";

    // Act
    var customizer =
        factory.createForParameter(annotation, null, method, parameter, 0, String.class);
    customizer.apply(statement, serviceId);

    // Assert
    verify(statement)
        .define(
            eq(annotation.value()),
            eq("JSON_CONTAINS(JSON_EXTRACT(json, '$.custom.path[*].name'), JSON_QUOTE(:value))"));
    verify(statement).bind(eq("value"), eq(serviceId));
  }

  @Test
  void testCreateForParameter_withNullArgument() throws SQLException {
    // Create a separate mock for this test
    SqlStatement<?> nullStatement = mock(SqlStatement.class);
    StatementContext nullContext = mock(StatementContext.class);
    when(nullStatement.getContext()).thenReturn(nullContext);
    when(nullContext.getConnection()).thenReturn(connection);

    // Act
    var customizer =
        factory.createForParameter(annotation, null, method, parameter, 0, String.class);
    customizer.apply(nullStatement, null);

    // Assert - with null arg, should define the ifNull value and never call bind
    verify(nullStatement).define(eq(annotation.value()), eq("TRUE"));
    verify(nullStatement, never()).bind(anyString(), (Object) any());
  }

  @Test
  void testCreateForParameter_withNullArgument_customIfNull() throws SQLException {
    // Arrange
    when(annotation.ifNull()).thenReturn("other_condition = 1");

    SqlStatement<?> nullStatement = mock(SqlStatement.class);
    StatementContext nullContext = mock(StatementContext.class);
    when(nullStatement.getContext()).thenReturn(nullContext);
    when(nullContext.getConnection()).thenReturn(connection);

    // Act
    var customizer =
        factory.createForParameter(annotation, null, method, parameter, 0, String.class);
    customizer.apply(nullStatement, null);

    // Assert - should use the custom ifNull value
    verify(nullStatement).define(eq(annotation.value()), (Object) eq("other_condition = 1"));
  }
}
