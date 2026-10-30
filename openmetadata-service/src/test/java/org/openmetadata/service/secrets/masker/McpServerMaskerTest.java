/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.Env;
import org.openmetadata.schema.entity.ai.McpConnectionConfig;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

class McpServerMaskerTest {
  @Test
  void masksCredentialsWithoutGuessingEnvironmentNamesOrArgumentSyntax() {
    final McpConnectionConfig config =
        new McpConnectionConfig()
            .withCommand("npx")
            .withArgs(List.of("--token=argument-secret", "postgresql://user:password@localhost/db"))
            .withEnv(
                new Env()
                    .withAdditionalProperty("DATABASE_PASSWORD", "database-secret")
                    .withAdditionalProperty("CUSTOM_SETTING", "Bearer token-secret"))
            .withUrl("https://user:password@mcp.example.com/?api_key=url-secret")
            .withWorkingDirectory("/workspace")
            .withTimeout(5000)
            .withRetryAttempts(3);
    final McpServer server = new McpServer().withConnectionConfig(config);

    assertSame(server, McpServerMasker.mask(server));

    assertEquals(List.of(PASSWORD_MASK, PASSWORD_MASK), config.getArgs());
    assertEquals(
        Map.of("DATABASE_PASSWORD", PASSWORD_MASK, "CUSTOM_SETTING", PASSWORD_MASK),
        config.getEnv().getAdditionalProperties());
    assertEquals(PASSWORD_MASK, config.getUrl());
    assertEquals("npx", config.getCommand());
    assertEquals("/workspace", config.getWorkingDirectory());
    assertEquals(5000, config.getTimeout());
    assertEquals(3, config.getRetryAttempts());
  }

  @Test
  void preservesAbsentConfigAndOptionalFields() {
    assertNull(McpServerMasker.mask(null));
    assertNull(McpServerMasker.mask(new McpServer()).getConnectionConfig());
    final McpConnectionConfig config = new McpConnectionConfig().withArgs(null);

    McpServerMasker.mask(new McpServer().withConnectionConfig(config));

    assertNull(config.getArgs());
    assertNull(config.getEnv());
    assertNull(config.getUrl());
  }

  @Test
  void preservesEmptyCollectionsAndSupportsRepeatedMasking() {
    final McpServer server =
        new McpServer()
            .withConnectionConfig(
                new McpConnectionConfig().withArgs(List.of()).withEnv(new Env()).withUrl(""));

    McpServerMasker.mask(server);
    final String maskedJson = JsonUtils.pojoToJson(server);
    McpServerMasker.mask(server);

    assertTrue(server.getConnectionConfig().getArgs().isEmpty());
    assertTrue(server.getConnectionConfig().getEnv().getAdditionalProperties().isEmpty());
    assertEquals(PASSWORD_MASK, server.getConnectionConfig().getUrl());
    assertEquals(maskedJson, JsonUtils.pojoToJson(server));
  }

  @Test
  void masksConnectionChangesInBothDescriptionsWhenCurrentConfigIsAbsent() {
    final McpServer server =
        new McpServer()
            .withChangeDescription(connectionChanges())
            .withIncrementalChangeDescription(connectionChanges());

    McpServerMasker.mask(server);

    for (final ChangeDescription changes :
        List.of(server.getChangeDescription(), server.getIncrementalChangeDescription())) {
      assertEquals(PASSWORD_MASK, changes.getFieldsAdded().getFirst().getNewValue());
      assertNull(changes.getFieldsAdded().getFirst().getOldValue());
      assertEquals(PASSWORD_MASK, changes.getFieldsUpdated().getFirst().getOldValue());
      assertEquals(PASSWORD_MASK, changes.getFieldsUpdated().getFirst().getNewValue());
      assertEquals(PASSWORD_MASK, changes.getFieldsDeleted().getFirst().getOldValue());
      assertNull(changes.getFieldsDeleted().getFirst().getNewValue());
    }
  }

  @Test
  void leavesOtherChangesAndAbsentChangeListsAlone() {
    final FieldChange unrelated =
        new FieldChange().withName("connectionConfiguration").withNewValue("visible");
    final FieldChange unnamed = new FieldChange().withNewValue("also visible");
    final ChangeDescription changes =
        new ChangeDescription()
            .withFieldsAdded(null)
            .withFieldsUpdated(List.of(unrelated, unnamed))
            .withFieldsDeleted(null);

    McpServerMasker.mask(new McpServer().withChangeDescription(changes));

    assertNull(changes.getFieldsAdded());
    assertNull(changes.getFieldsDeleted());
    assertEquals("visible", unrelated.getNewValue());
    assertEquals("also visible", unnamed.getNewValue());
  }

  private static ChangeDescription connectionChanges() {
    return new ChangeDescription()
        .withFieldsAdded(
            List.of(new FieldChange().withName("connectionConfig").withNewValue("legacy-secret")))
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("connectionConfig.env.DATABASE_PASSWORD")
                    .withOldValue("old-secret")
                    .withNewValue("new-secret")))
        .withFieldsDeleted(
            List.of(new FieldChange().withName("connectionConfig.url").withOldValue("url-secret")));
  }
}
