/*
 *  Copyright 2025 Collate
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

package org.openmetadata.mcp.usage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.jdbi3.CollectionDAO;

class McpUsageRecorderTest {

  private CollectionDAO.AppExtensionTimeSeries dao;
  private MockedStatic<Entity> entityStatic;

  @BeforeEach
  void setUp() {
    dao = mock(CollectionDAO.AppExtensionTimeSeries.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(dao);

    entityStatic = Mockito.mockStatic(Entity.class);
    entityStatic.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
  }

  @AfterEach
  void tearDown() {
    entityStatic.close();
  }

  @Test
  void recordWritesUsageRowWithMcpIdentity() {
    long before = System.currentTimeMillis();
    McpUsageRecorder.record("search_metadata", "alice", true);
    long after = System.currentTimeMillis();

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> ext = ArgumentCaptor.forClass(String.class);
    verify(dao, times(1)).insert(json.capture(), ext.capture());
    assertThat(ext.getValue()).isEqualTo("limits");

    McpToolCallUsage decoded = JsonUtils.readValue(json.getValue(), McpToolCallUsage.class);
    assertThat(decoded.getAppId()).isEqualTo(McpAppConstants.MCP_APP_ID);
    assertThat(decoded.getAppName()).isEqualTo(McpAppConstants.MCP_APP_NAME);
    assertThat(decoded.getToolName()).isEqualTo("search_metadata");
    assertThat(decoded.getUserName()).isEqualTo("alice");
    assertThat(decoded.getSuccess()).isTrue();
    assertThat(decoded.getExtension()).isEqualTo(AppExtension.ExtensionType.LIMITS);
    assertThat(decoded.getTimestamp()).isBetween(before, after);
  }

  /**
   * The {@code apps_extension_time_series} table has generated columns {@code appId},
   * {@code appName}, and {@code timestamp} that read from the JSON payload using those exact
   * property names. If the serialized field names ever drift (rename, missing field) the rows
   * still insert but the columns become null, breaking every read query. Lock the on-the-wire
   * names so the contract is checked at build time rather than via a failing prod query.
   */
  @Test
  void serializedJsonContainsGeneratedColumnFieldNames() {
    McpUsageRecorder.record("any_tool", "alice", true);

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(dao).insert(json.capture(), eq("limits"));
    String raw = json.getValue();
    assertThat(raw).contains("\"appId\":");
    assertThat(raw).contains("\"appName\":");
    assertThat(raw).contains("\"timestamp\":");
    assertThat(raw).contains("\"extension\":\"limits\"");
  }

  @Test
  void recordSwallowsDaoException() {
    doThrow(new RuntimeException("db down")).when(dao).insert(anyString(), eq("limits"));

    McpUsageRecorder.record("create_glossary", "alice", false);

    verify(dao, times(1)).insert(anyString(), eq("limits"));
  }

  @Test
  void recordCapturesFailureFlag() {
    McpUsageRecorder.record("patch_entity", "bob", false);

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(dao).insert(json.capture(), eq("limits"));
    McpToolCallUsage decoded = JsonUtils.readValue(json.getValue(), McpToolCallUsage.class);
    assertThat(decoded.getSuccess()).isFalse();
  }

  @Test
  void recordCapturesPhase3Metadata() {
    McpUsageRecorder.record(
        "create_glossary",
        "bob",
        false,
        342L,
        McpToolCallUsage.ErrorCategory.AUTH,
        "Claude Desktop");

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(dao).insert(json.capture(), eq("limits"));
    McpToolCallUsage decoded = JsonUtils.readValue(json.getValue(), McpToolCallUsage.class);
    assertThat(decoded.getLatencyMs()).isEqualTo(342L);
    assertThat(decoded.getErrorCategory()).isEqualTo(McpToolCallUsage.ErrorCategory.AUTH);
    assertThat(decoded.getClientName()).isEqualTo("Claude Desktop");
  }

  @Test
  void legacy3ArgOverloadOmitsPhase3Fields() {
    McpUsageRecorder.record("search_metadata", "alice", true);

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(dao).insert(json.capture(), eq("limits"));
    McpToolCallUsage decoded = JsonUtils.readValue(json.getValue(), McpToolCallUsage.class);
    assertThat(decoded.getLatencyMs()).isNull();
    assertThat(decoded.getErrorCategory()).isNull();
    assertThat(decoded.getClientName()).isNull();
  }
}
