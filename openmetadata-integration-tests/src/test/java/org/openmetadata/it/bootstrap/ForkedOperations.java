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
package org.openmetadata.it.bootstrap;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import io.dropwizard.testing.ResourceHelpers;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.openmetadata.it.bootstrap.ForkedServerConfig.Ports;
import org.openmetadata.it.util.SdkClients;

/**
 * Runs {@code OpenMetadataOperations}, the ops CLI, in its own JVM against the suite's database with
 * the suite's configuration. The CLI has no verifier and tells no server about what it wrote, as in
 * production. Run in the test JVM it would share the suite server's statics, and a write it made
 * could reach the suite server's verifier through them.
 */
public final class ForkedOperations {
  private static final String MAIN_CLASS = "org.openmetadata.service.util.OpenMetadataOperations";
  private static final long TIMEOUT_MINUTES = 5;
  private static final AtomicInteger SEQUENCE = new AtomicInteger();

  private ForkedOperations() {}

  /**
   * Runs one CLI command, for example {@code run("regenerate-bot-tokens", "--expiry", "Seven")}.
   *
   * @return the CLI's exit code; its output is in {@code target/forked-ops-<n>.log}
   */
  public static int run(String... command) {
    return run(config -> {}, command);
  }

  /**
   * Runs one CLI command with the rendered configuration adjusted by the caller, for example to
   * point {@code jwtTokenConfiguration} at another key pair.
   */
  public static int run(Consumer<ObjectNode> adjustConfig, String... command) {
    return runCapturing(adjustConfig, command).exitCode();
  }

  /** The exit code of one CLI run and what that run, and only that run, wrote to its log. */
  public record Outcome(int exitCode, String output) {}

  /** As {@link #run(Consumer, String...)}, and also returns the run's output. */
  public static Outcome runCapturing(Consumer<ObjectNode> adjustConfig, String... command) {
    int number = SEQUENCE.incrementAndGet();
    Path log = ForkedJvm.logFile("forked-ops-" + number + ".log");
    long logSizeBefore = sizeOf(log);
    List<String> args = new ArrayList<>(List.of("-c", writeYaml(number, adjustConfig).toString()));
    args.addAll(List.of(command));
    Process process = ForkedJvm.launch(MAIN_CLASS, args, Map.of("user.timezone", "UTC"), log);
    try {
      if (!process.waitFor(TIMEOUT_MINUTES, TimeUnit.MINUTES)) {
        process.destroyForcibly();
        throw new IllegalStateException("Ops command timed out, see " + log);
      }
    } catch (InterruptedException interrupted) {
      process.destroyForcibly();
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while running the ops command", interrupted);
    }
    return new Outcome(process.exitValue(), outputSince(log, logSizeBefore));
  }

  private static long sizeOf(Path log) {
    try {
      return Files.exists(log) ? Files.size(log) : 0;
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
  }

  // The log is appended to, so an earlier JVM's run of the same number is not part of this one.
  private static String outputSince(Path log, long offset) {
    try {
      byte[] all = Files.readAllBytes(log);
      return new String(all, (int) offset, all.length - (int) offset, StandardCharsets.UTF_8);
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
  }

  private static Path writeYaml(int number, Consumer<ObjectNode> adjustConfig) {
    Path baseYaml = Path.of(ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml"));
    try {
      String yaml =
          ForkedServerConfig.render(
              baseYaml,
              TestSuiteBootstrap.createApplicationConfigCopy(),
              new Ports(0, 0),
              Map.of());
      YAMLMapper mapper = new YAMLMapper();
      ObjectNode root = (ObjectNode) mapper.readTree(yaml);
      // The CLI checks the signing key against the server it is configured for, as in production.
      ((ObjectNode) root.path("pipelineServiceClientConfiguration"))
          .put("metadataApiEndpoint", SdkClients.baseUrl());
      adjustConfig.accept(root);
      return Files.writeString(
          ForkedJvm.logFile("forked-ops-" + number + ".yaml"), mapper.writeValueAsString(root));
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
  }
}
