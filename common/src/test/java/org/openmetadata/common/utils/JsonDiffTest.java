package org.openmetadata.common.utils;

import org.apache.commons.io.IOUtils;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class JsonDiffTest {
  @Test
  public void generateAndPrintDiff() throws IOException {
    String v1 = IOUtils.toString(JsonDiffTest.class.getClassLoader().getResourceAsStream("json/dim_location/v1.json"),
            StandardCharsets.UTF_8);
    String v2 = IOUtils.toString(JsonDiffTest.class.getClassLoader().getResourceAsStream("json/dim_location/v2.json"),
            StandardCharsets.UTF_8);

    String diff = JsonSchemaUtil.diffTwoJson(v1, v2);
    System.out.println(diff);
  }
}
