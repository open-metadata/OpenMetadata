package org.openmetadata.catalog.resources.feeds;

import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class MessageParserTest {
  @Test
  public void parseMessage() {
    String s = "abcd <angle1> <angle2> <angle3> " +  // Text in angled brackets that are not entity links
            "<#E> " +                                // Invalid entity link
            "<#E/table/ " +                         // Invalid entity link
            "<#E/table/tableFQN " +                 // Invalid entity link
            "<#E/table/tableFQN> " +
            "<#E/table/tableFQN/description> " +
            "<#E/table/tableFQN/columns/c1> ";
    List<EntityLink> links = MessageParser.getEntityLinks(s);
    assertEquals(3, links.size());
    assertEquals(new EntityLink("table", "tableFQN", null, null), links.get(0));
    assertEquals(new EntityLink("table", "tableFQN", "description", null), links.get(1));
    assertEquals(new EntityLink("table", "tableFQN", "columns", "c1"), links.get(2));
  }
}
