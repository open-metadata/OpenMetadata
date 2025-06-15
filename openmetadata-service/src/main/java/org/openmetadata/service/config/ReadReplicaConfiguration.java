/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.util.Duration;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/**
 * Configuration for read replica database connection.
 * This allows OpenMetadata to use a separate database instance for read operations
 * while keeping all write operations on the primary database.
 */
@Getter
@Setter
public class ReadReplicaConfiguration {

  @JsonProperty("host")
  @NotBlank
  private String host;

  @JsonProperty("port")
  private Integer port;

  @JsonProperty("databaseName")
  private String databaseName;

  @JsonProperty("auth")
  private AuthConfiguration auth;

  @JsonProperty("maxSize")
  private Integer maxSize;

  @JsonProperty("minSize")
  private Integer minSize;

  @JsonProperty("initialSize")
  private Integer initialSize;

  @JsonProperty("checkConnectionWhileIdle")
  private Boolean checkConnectionWhileIdle;

  @JsonProperty("checkConnectionOnBorrow")
  private Boolean checkConnectionOnBorrow;

  @JsonProperty("evictionInterval")
  private Duration evictionInterval;

  @JsonProperty("minIdleTime")
  private Duration minIdleTime;

  @Getter
  @Setter
  public static class AuthConfiguration {
    @JsonProperty("username")
    private String username;

    @JsonProperty("password")
    private String password;
  }

  /**
   * Creates a DataSourceFactory from this read replica configuration,
   * inheriting defaults from the primary DataSourceFactory where not specified.
   *
   * @param primaryDataSourceFactory The primary database configuration to inherit from
   * @return A configured DataSourceFactory for the read replica
   */
  public DataSourceFactory toDataSourceFactory(DataSourceFactory primaryDataSourceFactory) {
    // If host is not provided or empty, replica is not configured
    if (this.host == null || this.host.trim().isEmpty()) {
      return null;
    }
    DataSourceFactory replicaFactory = new DataSourceFactory();

    // Copy basic settings from primary
    replicaFactory.setDriverClass(primaryDataSourceFactory.getDriverClass());

    // Use replica-specific settings or fall back to primary
    String dbScheme = primaryDataSourceFactory.getUrl().split("://")[0].split(":")[1];
    String replicaDatabaseName =
        this.databaseName != null
            ? this.databaseName
            : primaryDataSourceFactory.getUrl()
                .split("/")[primaryDataSourceFactory.getUrl().split("/").length - 1]
                .split("\\?")[0];

    String replicaUrl =
        String.format(
            "jdbc:%s://%s:%s/%s",
            dbScheme,
            this.host,
            this.port != null ? this.port : extractPortFromPrimary(primaryDataSourceFactory),
            replicaDatabaseName);

    // Add URL parameters from primary if they exist
    String primaryUrl = primaryDataSourceFactory.getUrl();
    if (primaryUrl.contains("?")) {
      String params = primaryUrl.substring(primaryUrl.indexOf("?"));
      replicaUrl += params;
    }

    replicaFactory.setUrl(replicaUrl);

    // Set authentication
    if (this.auth != null) {
      replicaFactory.setUser(
          this.auth.getUsername() != null
              ? this.auth.getUsername()
              : primaryDataSourceFactory.getUser());
      replicaFactory.setPassword(
          this.auth.getPassword() != null
              ? this.auth.getPassword()
              : primaryDataSourceFactory.getPassword());
    } else {
      replicaFactory.setUser(primaryDataSourceFactory.getUser());
      replicaFactory.setPassword(primaryDataSourceFactory.getPassword());
    }

    // Set connection pool settings
    replicaFactory.setMaxSize(
        this.maxSize != null ? this.maxSize : primaryDataSourceFactory.getMaxSize());
    replicaFactory.setMinSize(
        this.minSize != null ? this.minSize : primaryDataSourceFactory.getMinSize());
    replicaFactory.setInitialSize(
        this.initialSize != null ? this.initialSize : primaryDataSourceFactory.getInitialSize());
    replicaFactory.setCheckConnectionWhileIdle(
        this.checkConnectionWhileIdle != null
            ? this.checkConnectionWhileIdle
            : primaryDataSourceFactory.getCheckConnectionWhileIdle());
    replicaFactory.setCheckConnectionOnBorrow(
        this.checkConnectionOnBorrow != null
            ? this.checkConnectionOnBorrow
            : primaryDataSourceFactory.getCheckConnectionOnBorrow());

    // Handle Duration objects properly
    if (this.evictionInterval != null) {
      replicaFactory.setEvictionInterval(this.evictionInterval);
    } else {
      replicaFactory.setEvictionInterval(primaryDataSourceFactory.getEvictionInterval());
    }

    if (this.minIdleTime != null) {
      replicaFactory.setMinIdleTime(this.minIdleTime);
    } else {
      replicaFactory.setMinIdleTime(primaryDataSourceFactory.getMinIdleTime());
    }

    return replicaFactory;
  }

  private String extractPortFromPrimary(DataSourceFactory primaryDataSourceFactory) {
    try {
      String url = primaryDataSourceFactory.getUrl();
      // Extract port from URL like "jdbc:mysql://host:3306/database"
      String hostPart = url.split("://")[1].split("/")[0];
      if (hostPart.contains(":")) {
        return hostPart.split(":")[1];
      }
      // Default ports based on driver
      String driverClass = primaryDataSourceFactory.getDriverClass();
      if (driverClass.contains("mysql")) {
        return "3306";
      } else if (driverClass.contains("postgresql")) {
        return "5432";
      }
      return "3306"; // Default fallback
    } catch (Exception e) {
      return "3306"; // Safe default
    }
  }
}
