/*
 *  Copyright 2021 Collate 
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
