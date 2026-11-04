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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Starts a JVM that shares nothing with the test JVM but the files and services it is pointed at.
 * It runs on the test JVM's own class path, so it loads the same server code, and writes its output
 * to a log file under {@code target/}.
 */
final class ForkedJvm {
  private static final String HEAP = "-Xmx1g";
  private static final Path LOG_DIR = Path.of("target");

  private ForkedJvm() {}

  static Path logFile(String name) {
    try {
      Files.createDirectories(LOG_DIR);
    } catch (IOException failure) {
      throw new IllegalStateException("Cannot create " + LOG_DIR, failure);
    }
    return LOG_DIR.resolve(name);
  }

  static Process launch(
      String mainClass, List<String> args, Map<String, String> systemProperties, Path log) {
    List<String> command = new ArrayList<>();
    command.add(Path.of(System.getProperty("java.home"), "bin", "java").toString());
    command.add(HEAP);
    systemProperties.forEach((key, value) -> command.add("-D" + key + "=" + value));
    command.add("-cp");
    command.add(System.getProperty("java.class.path"));
    command.add(mainClass);
    command.addAll(args);
    try {
      return new ProcessBuilder(command)
          .redirectErrorStream(true)
          .redirectOutput(ProcessBuilder.Redirect.appendTo(log.toFile()))
          .start();
    } catch (IOException failure) {
      throw new IllegalStateException("Cannot start " + mainClass, failure);
    }
  }
}
