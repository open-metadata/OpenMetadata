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

package org.openmetadata.service.util.jdbi;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.jdbi.v3.core.statement.SqlStatement;
import org.junit.jupiter.api.Test;

class BindJsonTest {

  @Test
  void factorySanitizesJsonBeforeBinding() throws Exception {
    BindJson annotation = mock(BindJson.class);
    SqlStatement<?> statement = mock(SqlStatement.class);
    String json = "{\"description\":\"nested >\\u0000< NUL\"}";
    String expected = "{\"description\":\"nested >< NUL\"}";
    when(annotation.value()).thenReturn("json");

    var customizer =
        new BindJson.Factory().createForParameter(annotation, null, null, null, 0, String.class);
    customizer.apply(statement, json);

    verify(statement).bind("json", expected);
  }
}
