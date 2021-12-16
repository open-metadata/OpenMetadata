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

package org.openmetadata.catalog.resources.feeds;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;

public class MessageParserTest {
  @Test
  public void parseMessage() {
    String s =
        "abcd <angle1> <angle2> <angle3> "
            + // Text in angled brackets that are not entity links
            "<#E> "
            + // Invalid entity link
            "<#E/table/ "
            + // Invalid entity link
            "<#E/table/tableFQN "
            + // Invalid entity link
            "<#E/table/tableFQN> "
            + "<#E/table/tableFQN/description> "
            + "<#E/table/tableFQN/columns/c1> ";
    List<EntityLink> links = MessageParser.getEntityLinks(s);
    assertEquals(3, links.size());
    assertEquals(new EntityLink("table", "tableFQN", null, null), links.get(0));
    assertEquals(new EntityLink("table", "tableFQN", "description", null), links.get(1));
    assertEquals(new EntityLink("table", "tableFQN", "columns", "c1"), links.get(2));
  }
}
