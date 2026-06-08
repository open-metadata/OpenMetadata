package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Properties;
import org.junit.jupiter.api.Test;

class HikariCPDataSourceFactoryAzureAuthTest {

  @Test
  void detectsAzureMarkerOnlyAtParameterBoundary() {
    assertTrue(
        HikariCPDataSourceFactory.hasAzureAuthMarker(
            "jdbc:postgresql://h.postgres.database.azure.com:5432/db?azure=true&sslmode=require"));
    assertTrue(
        HikariCPDataSourceFactory.hasAzureAuthMarker(
            "jdbc:postgresql://h.postgres.database.azure.com:5432/db?sslmode=require&azure=true"));
    assertFalse(
        HikariCPDataSourceFactory.hasAzureAuthMarker(
            "jdbc:postgresql://h.postgres.database.azure.com:5432/db?nonazure=true"));
    assertFalse(
        HikariCPDataSourceFactory.hasAzureAuthMarker(
            "jdbc:postgresql://h.postgres.database.azure.com:5432/db?sslmode=require"));
    assertFalse(
        HikariCPDataSourceFactory.hasAzureAuthMarker(
            "jdbc:postgresql://h.postgres.database.azure.com:5432/db?azure=truefoo"));
    assertFalse(
        HikariCPDataSourceFactory.hasAzureAuthMarker(
            "jdbc:postgresql://h.postgres.database.azure.com:5432/db?azure=truefoo&sslmode=require"));
    assertFalse(HikariCPDataSourceFactory.hasAzureAuthMarker(null));
  }

  @Test
  void postgresDriverGetsAzurePostgresqlAuthenticationPlugin() {
    Properties props = new Properties();
    HikariCPDataSourceFactory.applyAzureEntraAuthProperties(props, "org.postgresql.Driver");

    assertEquals(
        HikariCPDataSourceFactory.AZURE_POSTGRESQL_AUTH_PLUGIN,
        props.get(HikariCPDataSourceFactory.POSTGRESQL_AUTH_PLUGIN_PROPERTY));
    assertFalse(props.containsKey(HikariCPDataSourceFactory.MYSQL_DEFAULT_AUTH_PLUGIN_PROPERTY));
  }

  @Test
  void mysqlDriverGetsAzureMysqlAuthenticationPlugin() {
    Properties props = new Properties();
    HikariCPDataSourceFactory.applyAzureEntraAuthProperties(props, "com.mysql.cj.jdbc.Driver");

    assertEquals(
        HikariCPDataSourceFactory.AZURE_MYSQL_AUTH_PLUGIN,
        props.get(HikariCPDataSourceFactory.MYSQL_DEFAULT_AUTH_PLUGIN_PROPERTY));
    assertEquals(
        HikariCPDataSourceFactory.AZURE_MYSQL_AUTH_PLUGIN,
        props.get(HikariCPDataSourceFactory.MYSQL_AUTH_PLUGINS_PROPERTY));
    assertFalse(props.containsKey(HikariCPDataSourceFactory.POSTGRESQL_AUTH_PLUGIN_PROPERTY));
  }

  @Test
  void unknownDriverGetsNoAuthenticationPlugin() {
    Properties props = new Properties();
    HikariCPDataSourceFactory.applyAzureEntraAuthProperties(props, "org.h2.Driver");

    assertNull(props.get(HikariCPDataSourceFactory.POSTGRESQL_AUTH_PLUGIN_PROPERTY));
    assertNull(props.get(HikariCPDataSourceFactory.MYSQL_DEFAULT_AUTH_PLUGIN_PROPERTY));
  }

  @Test
  void nullDriverIsHandledSafely() {
    Properties props = new Properties();
    HikariCPDataSourceFactory.applyAzureEntraAuthProperties(props, null);

    assertEquals(0, props.size());
  }
}
