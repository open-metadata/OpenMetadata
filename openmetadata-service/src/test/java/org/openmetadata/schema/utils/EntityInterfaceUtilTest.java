/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.schema.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/**
 * Pins the owner/user alert-filter fix: a username containing a dot is FQN-quoted (e.g. {@code
 * ram.balaji} -> {@code "ram.balaji"}), and the name-based alert matchers must compare against the
 * raw name. {@link EntityInterfaceUtil#unquoteName} is the normalization those matchers apply.
 */
class EntityInterfaceUtilTest {

  @Test
  void unquoteName_stripsQuotesFromDottedName() {
    assertEquals("ram.balaji", EntityInterfaceUtil.unquoteName("\"ram.balaji\""));
    assertEquals("Data.Engineering", EntityInterfaceUtil.unquoteName("\"Data.Engineering\""));
  }

  @Test
  void unquoteName_leavesPlainNameUnchanged() {
    assertEquals("ram.balaji", EntityInterfaceUtil.unquoteName("ram.balaji"));
    assertEquals("john", EntityInterfaceUtil.unquoteName("john"));
  }

  @Test
  void unquoteName_isInverseOfQuoteName() {
    for (String name : new String[] {"ram.balaji", "Data.Engineering", "john", "team_a"}) {
      assertEquals(name, EntityInterfaceUtil.unquoteName(EntityInterfaceUtil.quoteName(name)));
    }
  }

  @Test
  void unquoteName_handlesNullAndEmptyWithoutThrowing() {
    assertNull(EntityInterfaceUtil.unquoteName(null));
    assertEquals("", EntityInterfaceUtil.unquoteName(""));
    assertEquals("\"", EntityInterfaceUtil.unquoteName("\""));
  }
}
