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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.output.OutputFrame;

class InnoDbDeadlockReportLoggerTest {

  @Test
  void handsOverEachDeadlockReportWholeAndIgnoresTheRestOfTheLog() {
    List<String> reports = new ArrayList<>();
    InnoDbDeadlockReportLogger logger = new InnoDbDeadlockReportLogger(reports::add);

    feed(
        logger,
        "[Server] ready for connections",
        "[InnoDB] Transactions deadlock detected, dumping detailed information.",
        "*** (1) TRANSACTION:",
        "/* ConversationDAO.findByIdForUpdate */ SELECT json FROM conversation_entity FOR UPDATE",
        "*** WE ROLL BACK TRANSACTION (2)",
        "[Server] Aborted connection 12",
        "[InnoDB] Transactions deadlock detected, dumping detailed information.",
        "*** WE ROLL BACK TRANSACTION (1)");

    assertEquals(2, reports.size());
    assertTrue(reports.getFirst().contains("ConversationDAO.findByIdForUpdate"));
    assertTrue(reports.getFirst().contains("WE ROLL BACK TRANSACTION (2)"));
    assertTrue(reports.stream().noneMatch(report -> report.contains("Aborted connection")));
  }

  private static void feed(InnoDbDeadlockReportLogger logger, String... lines) {
    for (String line : lines) {
      logger.accept(
          new OutputFrame(
              OutputFrame.OutputType.STDERR, (line + "\n").getBytes(StandardCharsets.UTF_8)));
    }
  }
}
