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

import io.dropwizard.testing.ResourceHelpers;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.openmetadata.it.bootstrap.ForkedServerConfig.Ports;

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
    int number = SEQUENCE.incrementAndGet();
    Path log = ForkedJvm.logFile("forked-ops-" + number + ".log");
    List<String> args = new ArrayList<>(List.of("-c", writeYaml(number).toString()));
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
    return process.exitValue();
  }

  private static Path writeYaml(int number) {
    Path baseYaml = Path.of(ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml"));
    try {
      String yaml =
          ForkedServerConfig.render(
              baseYaml,
              TestSuiteBootstrap.createApplicationConfigCopy(),
              new Ports(0, 0),
              Map.of());
      return Files.writeString(ForkedJvm.logFile("forked-ops-" + number + ".yaml"), yaml);
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    }
  }
}
