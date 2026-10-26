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

package org.openmetadata.it.tests.security.scale;

import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.management.JMException;
import javax.management.MBeanServer;
import javax.management.ObjectName;

/**
 * Live-object class histogram of this JVM, taken through the {@code DiagnosticCommand} MBean. The
 * command collects garbage first, so only reachable objects are counted.
 */
final class ClassHistogram {
  private static final Pattern LINE = Pattern.compile("^\\s*\\d+:\\s+(\\d+)\\s+(\\d+)\\s+(\\S+)");

  private final Map<String, Long> bytesByClass;

  private ClassHistogram(Map<String, Long> bytesByClass) {
    this.bytesByClass = bytesByClass;
  }

  static ClassHistogram take() {
    try {
      MBeanServer server = ManagementFactory.getPlatformMBeanServer();
      Object text =
          server.invoke(
              new ObjectName("com.sun.management:type=DiagnosticCommand"),
              "gcClassHistogram",
              new Object[] {new String[0]},
              new String[] {String[].class.getName()});
      return new ClassHistogram(parse(String.valueOf(text)));
    } catch (JMException failure) {
      throw new IllegalStateException("The class histogram could not be taken", failure);
    }
  }

  static Map<String, Long> parse(String text) {
    Map<String, Long> bytes = new HashMap<>();
    for (String line : text.split("\n")) {
      Matcher match = LINE.matcher(line);
      if (match.find()) {
        bytes.merge(match.group(3), Long.parseLong(match.group(2)), Long::sum);
      }
    }
    return bytes;
  }

  /** Bytes held by the classes whose name matches, now. */
  long bytes(Predicate<String> className) {
    return bytesByClass.entrySet().stream()
        .filter(entry -> className.test(entry.getKey()))
        .mapToLong(Map.Entry::getValue)
        .sum();
  }
}
