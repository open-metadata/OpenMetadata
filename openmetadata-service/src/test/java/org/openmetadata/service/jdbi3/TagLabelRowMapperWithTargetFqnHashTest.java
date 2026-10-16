package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelRowMapperWithTargetFqnHash;

class TagLabelRowMapperWithTargetFqnHashTest {

  @Test
  void glossaryLabelWhoseTermRowIsGoneIsReturnedUnenriched() throws SQLException {
    ResultSet row = tagUsageRow(TagLabel.TagSource.GLOSSARY, null);

    Pair<String, TagLabel> mapped = new TagLabelRowMapperWithTargetFqnHash().map(row, null);

    assertEquals("targetHash", mapped.getLeft());
    assertEquals("Glossary.Term", mapped.getRight().getTagFQN());
    assertNull(mapped.getRight().getName());
  }

  @Test
  void glossaryLabelIsEnrichedFromTheTermJson() throws SQLException {
    ResultSet row =
        tagUsageRow(
            TagLabel.TagSource.GLOSSARY,
            "{\"name\":\"Term\",\"displayName\":\"Term Display\",\"description\":\"d\"}");

    TagLabel label = new TagLabelRowMapperWithTargetFqnHash().map(row, null).getRight();

    assertEquals("Term", label.getName());
    assertEquals("Term Display", label.getDisplayName());
  }

  private static ResultSet tagUsageRow(TagLabel.TagSource source, String json) throws SQLException {
    ResultSet row = mock(ResultSet.class);
    when(row.getInt("source")).thenReturn(source.ordinal());
    when(row.getInt("labelType")).thenReturn(TagLabel.LabelType.MANUAL.ordinal());
    when(row.getInt("state")).thenReturn(TagLabel.State.CONFIRMED.ordinal());
    when(row.getString("tagFQN")).thenReturn("Glossary.Term");
    when(row.getString("targetFQNHash")).thenReturn("targetHash");
    when(row.getString("metadata")).thenReturn(null);
    when(row.getString("json")).thenReturn(json);
    return row;
  }
}
