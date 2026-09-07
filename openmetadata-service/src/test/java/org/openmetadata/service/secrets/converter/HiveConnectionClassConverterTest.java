package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.database.HiveConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.utils.JsonUtils;

class HiveConnectionClassConverterTest {

  private final ClassConverter converter = ClassConverterFactory.getConverter(HiveConnection.class);

  @Test
  void testConvertsPostgresMetastore() {
    PostgresConnection metastore =
        new PostgresConnection()
            .withHostPort("localhost:5432")
            .withUsername("postgres_user")
            .withDatabase("hive_metastore");

    HiveConnection input =
        new HiveConnection().withHostPort("localhost:10000").withMetastoreConnection(metastore);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    HiveConnection result = (HiveConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(PostgresConnection.class, result.getMetastoreConnection());
  }

  @Test
  void testConvertsMysqlMetastore() {
    MysqlConnection metastore =
        new MysqlConnection().withHostPort("localhost:3306").withUsername("mysql_user");

    HiveConnection input =
        new HiveConnection().withHostPort("localhost:10000").withMetastoreConnection(metastore);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    HiveConnection result = (HiveConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(MysqlConnection.class, result.getMetastoreConnection());
  }

  /**
   * Selecting "None" for the metastore submits an empty object. Converting it would match the first
   * candidate class and persist a metastore config built entirely from schema defaults, which the
   * ingestion framework then rejects as invalid.
   */
  @Test
  void testEmptyMetastoreIsLeftUntouched() {
    HiveConnection input =
        new HiveConnection().withHostPort("localhost:10000").withMetastoreConnection(Map.of());
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    HiveConnection result = (HiveConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(Map.class, result.getMetastoreConnection());
    assertEquals(Map.of(), result.getMetastoreConnection());
  }

  @Test
  void testNullMetastoreDoesNotThrow() {
    HiveConnection input = new HiveConnection().withHostPort("localhost:10000");
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    HiveConnection result = (HiveConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertNull(result.getMetastoreConnection());
  }
}
