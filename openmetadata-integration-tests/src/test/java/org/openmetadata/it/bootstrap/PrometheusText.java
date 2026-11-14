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

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads series out of the Prometheus text format that {@code /prometheus} serves. */
final class PrometheusText {
  private static final Pattern LABEL = Pattern.compile("(\\w+)=\"((?:[^\"\\\\]|\\\\.)*)\"");

  private PrometheusText() {}

  /**
   * The sum of the series called {@code name} whose labels include every given key and value.
   *
   * @throws IllegalStateException when no series matches, so a misspelled meter cannot read as zero
   */
  static double sum(String scrape, String name, String... tags) {
    double sum = 0;
    int matched = 0;
    for (String line : scrape.split("\n")) {
      if (matches(line, name, tags)) {
        sum += Double.parseDouble(line.substring(line.lastIndexOf(' ') + 1));
        matched++;
      }
    }
    if (matched == 0) {
      throw new IllegalStateException(
          "No series " + name + " with labels " + String.join(",", tags));
    }
    return sum;
  }

  private static boolean matches(String line, String name, String[] tags) {
    boolean found = line.startsWith(name) && line.length() > name.length();
    if (found) {
      char next = line.charAt(name.length());
      found = next == '{' || next == ' ';
    }
    return found && hasLabels(labels(line), tags);
  }

  private static Map<String, String> labels(String line) {
    Map<String, String> labels = new HashMap<>();
    int open = line.indexOf('{');
    int close = line.lastIndexOf('}');
    if (open >= 0 && close > open) {
      Matcher matcher = LABEL.matcher(line.substring(open, close));
      while (matcher.find()) {
        labels.put(matcher.group(1), matcher.group(2));
      }
    }
    return labels;
  }

  private static boolean hasLabels(Map<String, String> labels, String[] wanted) {
    boolean all = true;
    for (int i = 0; i < wanted.length; i += 2) {
      all &= wanted[i + 1].equals(labels.get(wanted[i]));
    }
    return all;
  }
}
