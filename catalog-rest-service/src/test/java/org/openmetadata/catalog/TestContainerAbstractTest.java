package org.openmetadata.catalog;

import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class TestContainerAbstractTest {

  public GenericContainer mysqlContainer;

  @BeforeAll
  void setup() {
    mysqlContainer =
        new GenericContainer(DockerImageName.parse("mysql/mysql-server:latest"))
            .withEnv("MYSQL_ALLOW_EMPTY_PASSWORD", "yes")
            .withEnv("MYSQL_ROOT_HOST", "%");
    mysqlContainer.setPortBindings(List.of("localhost:3307:3306"));
    mysqlContainer.start();
  }

  @AfterAll
  void teardown() {
    mysqlContainer.stop();
  }
}
