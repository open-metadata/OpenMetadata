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

package org.openmetadata.service.alerting.content.template.handlebars.helpers;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.alerting.content.template.HandlebarsProvider;
import org.openmetadata.service.alerting.content.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.alerting.content.template.handlebars.HandlebarsHelperMetadata;

class HandlebarsHelperMetadataTest {

  @ParameterizedTest
  @MethodSource("allHelpers")
  void cursorOffsetLandsRightAfterTheHelperName(HandlebarsHelper helper) {
    HandlebarsHelperMetadata metadata = helper.getMetadata();
    String syntax = metadata.getUsages().get(0).getSyntax();

    assertEquals(
        syntax.indexOf(' ') + 1,
        metadata.getCursorOffset(),
        () -> metadata.getName() + " places the cursor off its first argument in " + syntax);
  }

  private static Stream<HandlebarsHelper> allHelpers() {
    return HandlebarsProvider.getAllHelperInstances().stream();
  }
}
