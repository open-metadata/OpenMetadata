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

package org.openmetadata.catalog.resources;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

@Slf4j
public class EmbeddedMySqlSupport implements BeforeAllCallback, AfterAllCallback {
  static GenericContainer mysqlContainer;

  @Override
  public void beforeAll(ExtensionContext extensionContext) throws InterruptedException {
    if (mysqlContainer == null) {
      mysqlContainer =
          new GenericContainer(DockerImageName.parse("mysql/mysql-server:latest"))
              .withEnv("MYSQL_DATABASE", "openmetadata_test_db")
              .withEnv("MYSQL_ALLOW_EMPTY_PASSWORD", "yes")
              .withEnv("MYSQL_ROOT_HOST", "%")
              .withExposedPorts(3306);
      mysqlContainer.setPortBindings(List.of("localhost:3307:3306"));
      mysqlContainer.start();
      LOG.info("Docker MySQL is started");

      Flyway flyway =
          Flyway.configure()
              // TODO Remove hardcoding
              .dataSource(
                  "jdbc:mysql://localhost:3307/openmetadata_test_db?useSSL=false&serverTimezone=UTC", "root", "")
              .table("DATABASE_CHANGE_LOG")
              .sqlMigrationPrefix("v")
              .load();
      flyway.clean();
      flyway.migrate();
      LOG.info("Flyway migration is complete");
    } else {
      LOG.info("Docker MySQL is already running");
    }
  }

  @Override
  public void afterAll(ExtensionContext extensionContext) {
    if (mysqlContainer != null) {
      LOG.info("Stopping Docker MySQL");
      mysqlContainer.stop();
      mysqlContainer = null;
    }
  }
}
