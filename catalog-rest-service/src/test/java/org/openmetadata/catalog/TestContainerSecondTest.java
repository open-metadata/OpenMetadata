package org.openmetadata.catalog;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class TestContainerSecondTest extends TestContainerAbstractTest {
  @Test
  public void testSimplePutAndGet() {
    System.out.println(mysqlContainer.getMappedPort(3306));
    assertTrue(true);
  }
}
