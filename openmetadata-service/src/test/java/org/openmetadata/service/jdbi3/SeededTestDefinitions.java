package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.utils.JsonUtils;

/** The test definitions as they are seeded, read straight off the classpath. */
final class SeededTestDefinitions {
  private SeededTestDefinitions() {}

  static List<TestDefinition> all() throws IOException {
    List<TestDefinition> definitions = new ArrayList<>();
    for (String resource :
        CommonUtil.getResources(Pattern.compile(".*json/data/tests/.*\\.json$"))) {
      definitions.add(
          JsonUtils.readValue(
              CommonUtil.getResourceAsStream(
                  SeededTestDefinitions.class.getClassLoader(), resource),
              TestDefinition.class));
    }
    return definitions;
  }
}
