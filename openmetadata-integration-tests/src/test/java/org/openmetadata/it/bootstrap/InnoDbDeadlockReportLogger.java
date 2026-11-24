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

import java.util.function.Consumer;
import org.testcontainers.containers.output.OutputFrame;

/**
 * Picks the InnoDB deadlock reports out of the MySQL error log and hands each one over whole, so
 * a CI log shows both transactions of every deadlock, their statements and the locks they held.
 */
final class InnoDbDeadlockReportLogger implements Consumer<OutputFrame> {
  private static final String REPORT_START = "Transactions deadlock detected";
  private static final String REPORT_END = "WE ROLL BACK TRANSACTION";

  private final Consumer<String> reportSink;
  private final StringBuilder report = new StringBuilder();
  private boolean isInsideReport;

  InnoDbDeadlockReportLogger(final Consumer<String> reportSink) {
    this.reportSink = reportSink;
  }

  @Override
  public synchronized void accept(final OutputFrame frame) {
    final String line = frame.getUtf8String().stripTrailing();
    if (line.contains(REPORT_START)) {
      isInsideReport = true;
      report.setLength(0);
    }
    if (isInsideReport) {
      report.append(line).append(System.lineSeparator());
    }
    if (isInsideReport && line.contains(REPORT_END)) {
      isInsideReport = false;
      reportSink.accept(report.toString());
    }
  }
}
