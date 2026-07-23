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

package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Unit-level coverage for the User-Agent -> client name heuristic. The headers we recognise here
 * are the ones the Billing > MCP page renders explicitly; an unknown UA still produces a sensible
 * label so a new client surfaces in the per-user breakdown without an extractor change.
 */
class AuthEnrichedMcpContextExtractorTest {

  @Test
  void recognisesClaudeDesktop() {
    assertThat(
            AuthEnrichedMcpContextExtractor.resolveClientName(
                "Claude-Desktop/1.4.2 (macOS; arm64)"))
        .isEqualTo("Claude Desktop");
  }

  @Test
  void recognisesClaudeCli() {
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("claude-cli/0.9.1"))
        .isEqualTo("Claude CLI");
  }

  @Test
  void recognisesCursor() {
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("Cursor/0.42.3"))
        .isEqualTo("Cursor");
  }

  @Test
  void recognisesVSCode() {
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("Visual Studio Code/1.92.0"))
        .isEqualTo("VS Code");
  }

  @Test
  void vsCodeWithClaudeExtensionDoesNotMisclassifyAsCli() {
    assertThat(
            AuthEnrichedMcpContextExtractor.resolveClientName(
                "Visual Studio Code/1.92.0 claude-ext/1.0"))
        .isEqualTo("VS Code");
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("vscode-claude-ext/0.1"))
        .isEqualTo("VS Code");
  }

  @Test
  void claudeCodeIsRecognisedAsCli() {
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("claude-code/0.9.1"))
        .isEqualTo("Claude CLI");
  }

  @Test
  void unknownAgentFallsBackToCapitalisedProductToken() {
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("zed/0.150")).isEqualTo("Zed");
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("someTool/2.0 extra/info"))
        .isEqualTo("SomeTool");
  }

  @Test
  void nullAndBlankAgentsReturnNull() {
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName(null)).isNull();
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("")).isNull();
    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName("   ")).isNull();
  }

  @Test
  void oversizedFallbackTokenIsCappedToMaxLength() {
    String huge = "x".repeat(500) + "/1.0";

    String resolved = AuthEnrichedMcpContextExtractor.resolveClientName(huge);

    assertThat(resolved).isNotNull();
    assertThat(resolved.length()).isLessThanOrEqualTo(64);
  }

  @Test
  void controlCharactersAreStrippedFromResolvedClient() {
    String userAgent = "MyTool\u0001\u0007/1.0";

    assertThat(AuthEnrichedMcpContextExtractor.resolveClientName(userAgent)).isEqualTo("MyTool");
  }
}
