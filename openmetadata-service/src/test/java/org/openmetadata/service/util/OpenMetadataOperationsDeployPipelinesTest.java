/*
 *  Copyright 2025 Collate.
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import picocli.CommandLine;
import picocli.CommandLine.Model.CommandSpec;
import picocli.CommandLine.ParseResult;

class OpenMetadataOperationsDeployPipelinesTest {

  private static final Duration PREVIOUS_FIXED_TIMEOUT = Duration.ofMinutes(2);

  private static List<String> row(String status) {
    return List.of("pipeline", "metadata", "service", status);
  }

  @Test
  void chunkDeadlineScalesWithChunkSize() {
    assertEquals(Duration.ofSeconds(600), OpenMetadataOperations.deployChunkTimeout(20, 30));
    assertEquals(Duration.ofSeconds(3000), OpenMetadataOperations.deployChunkTimeout(100, 30));
  }

  @Test
  void defaultChunkDeadlineExceedsThePreviousFixedTimeout() {
    Duration deadline = OpenMetadataOperations.deployChunkTimeout(20, 30);

    assertTrue(
        deadline.compareTo(PREVIOUS_FIXED_TIMEOUT) > 0,
        "a chunk of 20 sequential deploys needs more than the previous fixed 2 minute deadline");
  }

  @Test
  void chunkDeadlineNeverDropsBelowTheFloor() {
    assertEquals(PREVIOUS_FIXED_TIMEOUT, OpenMetadataOperations.deployChunkTimeout(1, 5));
    assertEquals(PREVIOUS_FIXED_TIMEOUT, OpenMetadataOperations.deployChunkTimeout(4, 1));
  }

  @Test
  void defaultOptionsAreAccepted() {
    assertTrue(OpenMetadataOperations.isValidDeployOptions(20, 30));
    assertTrue(OpenMetadataOperations.isValidDeployOptions(1, 1));
  }

  @Test
  void nonPositiveChunkSizeIsRejected() {
    assertFalse(OpenMetadataOperations.isValidDeployOptions(0, 30));
    assertFalse(OpenMetadataOperations.isValidDeployOptions(-1, 30));
  }

  @Test
  void nonPositiveSecondsPerPipelineIsRejected() {
    assertFalse(OpenMetadataOperations.isValidDeployOptions(20, 0));
    assertFalse(OpenMetadataOperations.isValidDeployOptions(20, -5));
  }

  private static ParseResult parseDeployPipelines(String... args) {
    String[] argv = new String[args.length + 3];
    argv[0] = "-c";
    argv[1] = "unused.yaml";
    argv[2] = "deploy-pipelines";
    System.arraycopy(args, 0, argv, 3, args.length);

    return new CommandLine(new OpenMetadataOperations()).parseArgs(argv);
  }

  private static int optionValue(ParseResult parsed, String option, int fallback) {
    return parsed.subcommand().matchedOptionValue(option, fallback);
  }

  @Test
  void chunkSizeAndBudgetOptionsAreBound() {
    ParseResult parsed = parseDeployPipelines("--chunk-size", "5", "--seconds-per-pipeline", "45");

    assertEquals(5, optionValue(parsed, "--chunk-size", -1));
    assertEquals(45, optionValue(parsed, "--seconds-per-pipeline", -1));
    assertEquals(Duration.ofSeconds(225), OpenMetadataOperations.deployChunkTimeout(5, 45));
  }

  @Test
  void omittedOptionsFallBackToTheDocumentedDefaults() {
    CommandSpec spec = parseDeployPipelines().subcommand().commandSpec();

    assertEquals("20", spec.findOption("--chunk-size").defaultValue());
    assertEquals("30", spec.findOption("--seconds-per-pipeline").defaultValue());
  }

  @Test
  void failedRowsAreDetected() {
    assertTrue(
        OpenMetadataOperations.hasDeployFailures(
            List.of(row("DEPLOYED"), row("FAILED - 500: airflow unreachable"))));
  }

  @Test
  void deployedRowsAreNotFailures() {
    assertFalse(
        OpenMetadataOperations.hasDeployFailures(List.of(row("DEPLOYED"), row("DEPLOYED"))));
  }
}
