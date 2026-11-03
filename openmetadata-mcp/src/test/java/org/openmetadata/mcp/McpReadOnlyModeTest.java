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

package org.openmetadata.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.MCPConfiguration;

class McpReadOnlyModeTest {

  private static final Set<String> WRITE_TOOLS =
      Set.of("create_entity", "patch_entity", "create_lineage", "create_test_case");

  private static final MCPConfiguration READ_ONLY = new MCPConfiguration().withReadOnly(true);

  @Test
  void readOnlyModeWithholdsTheWriteToolsAndKeepsTheReadTools() {
    List<McpSchema.Tool> tools = new McpServer().getTools();

    List<String> exposed = names(McpServer.exposedTools(tools, READ_ONLY));

    WRITE_TOOLS.forEach(tool -> assertFalse(exposed.contains(tool), tool + " changes metadata"));
    assertEquals(tools.size() - WRITE_TOOLS.size(), exposed.size());
    assertTrue(exposed.contains("search_metadata"));
  }

  @Test
  void aToolWithoutAReadOnlyHintIsWithheld() {
    McpSchema.Tool unannotated = McpSchema.Tool.builder().name("unannotated").build();

    assertTrue(McpServer.exposedTools(List.of(unannotated), READ_ONLY).isEmpty());
  }

  @Test
  void everyToolIsExposedWhenReadOnlyIsOffOrUnset() {
    List<McpSchema.Tool> tools = new McpServer().getTools();

    assertEquals(tools, McpServer.exposedTools(tools, new MCPConfiguration()));
    assertEquals(tools, McpServer.exposedTools(tools, null));
  }

  private static List<String> names(List<McpSchema.Tool> tools) {
    return tools.stream().map(McpSchema.Tool::name).toList();
  }
}
