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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.util.LambdaExceptionUtil.rethrowComparator;
import static org.openmetadata.service.util.LambdaExceptionUtil.rethrowConsumer;
import static org.openmetadata.service.util.LambdaExceptionUtil.rethrowFunction;

import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;

@Slf4j
class LambdaExceptionUtilTest {

  @Test
  void testThrowingConsumer() {
    assertThrows(
        ClassNotFoundException.class,
        () -> Stream.of("java.lang.String", "java.bad.Class").forEach(rethrowConsumer(Class::forName)));
  }

  @Test
  void testThrowingFunction() {
    assertThrows(
        ClassNotFoundException.class,
        () ->
            Stream.of("java.lang.String", "java.bad.Class")
                .map(rethrowFunction(Class::forName))
                .collect(Collectors.toList()));
  }

  @Test
  void testThrowingComparator() {
    assertThrows(
        ClassNotFoundException.class,
        () ->
            Stream.of("java.lang.String", "java.lang.Integer", "java.bad.Class")
                .sorted(
                    rethrowComparator(
                        (c1, c2) -> Class.forName(c1).getFields().length - Class.forName(c2).getFields().length))
                .collect(Collectors.toList()));
  }
}
