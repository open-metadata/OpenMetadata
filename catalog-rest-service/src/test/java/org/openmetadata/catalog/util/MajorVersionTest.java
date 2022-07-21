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

package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;

@Slf4j
class MajorVersionTest {

  /** Test the next major version when current version is the first ever version */
  @Test
  void testMajorVersion() {

    /** Test the next major version when current version is the first ever version */
    assertEquals(1.0, EntityUtil.nextMajorVersion(0.1));

    /** Test the next major version when current version is x.0 */
    assertEquals(2.0, EntityUtil.nextMajorVersion(1.0));
    assertEquals(10.0, EntityUtil.nextMajorVersion(9.0));
    assertEquals(15.0, EntityUtil.nextMajorVersion(14.0));

    /** Test the next major version when current version is x.y where y != 0 */
    assertEquals(5.0, EntityUtil.nextMajorVersion(4.3));
    assertEquals(7.0, EntityUtil.nextMajorVersion(6.2));
    assertEquals(10.0, EntityUtil.nextMajorVersion(9.5));
  }
}
