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
package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Guards the Jena 6.2.0 bootstrap defect described in {@link RdfPropertyMapper}: a JVM that reaches
 * Jena for the first time through a vocabulary constant dies in {@code TypeMapper.reset()} and
 * leaves {@code NodeFactory} permanently uninitializable, which is what took RDF glossary import,
 * ontology export and translation down together in CI. Verified to fail without the
 * {@code JenaSystem.init()} guard and pass with it.
 */
@DisplayName("RDF Jena bootstrap")
class RdfJenaBootstrapTest {

  private static final long PROBE_TIMEOUT_MINUTES = 2;

  @Test
  @DisplayName("a fresh JVM whose first Jena touch is the translator initializes cleanly")
  void translatorIsSafeAsTheFirstJenaTouch() throws IOException, InterruptedException {
    Path probeLog = Files.createTempFile("jena-bootstrap-probe", ".log");
    try {
      Process probe = startProbeJvm(probeLog);
      boolean exited = probe.waitFor(PROBE_TIMEOUT_MINUTES, TimeUnit.MINUTES);
      if (!exited) {
        probe.destroyForcibly().waitFor();
      }
      String output = Files.readString(probeLog);
      assertTrue(exited, "Jena bootstrap probe did not exit; output so far:\n" + output);
      assertEquals(0, probe.exitValue(), "Jena bootstrap probe failed:\n" + output);
    } finally {
      Files.deleteIfExists(probeLog);
    }
  }

  /**
   * Output goes to a file rather than a pipe so the timeout above is real. Draining {@code
   * getInputStream()} blocks until the process exits, and a JVM wedged in class initialization -
   * one of the ways this defect can present - would hang the test there instead of failing it.
   * A file also cannot fill the way a pipe buffer can, so a probe that dies with a long stack
   * trace still terminates on its own.
   */
  private static Process startProbeJvm(Path probeLog) throws IOException {
    String java =
        Path.of(System.getProperty("java.home"), "bin", "java").toAbsolutePath().toString();
    return new ProcessBuilder(
            java, "-cp", System.getProperty("java.class.path"), JenaFirstTouchProbe.class.getName())
        .redirectErrorStream(true)
        .redirectOutput(probeLog.toFile())
        .start();
  }
}
