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

  private static ResultSet orphanRow(TagLabel.TagSource source) throws SQLException {
    ResultSet rs = mock(ResultSet.class);
    when(rs.getInt("source")).thenReturn(source.ordinal());
    when(rs.getInt("labelType")).thenReturn(TagLabel.LabelType.MANUAL.ordinal());
    when(rs.getInt("state")).thenReturn(TagLabel.State.CONFIRMED.ordinal());
    when(rs.getString("tagFQN")).thenReturn("g.deletedTerm");
    when(rs.getString("targetFQNHash")).thenReturn("hash");
    when(rs.getString("json")).thenReturn(null);
    return rs;
  }

  @Test
  void orphanGlossaryUsageMapsToUnenrichedLabel() throws SQLException {
    Pair<String, TagLabel> row =
        new TagLabelRowMapperWithTargetFqnHash().map(orphanRow(TagLabel.TagSource.GLOSSARY), null);

    assertEquals("hash", row.getLeft());
    assertEquals("g.deletedTerm", row.getRight().getTagFQN());
    assertNull(row.getRight().getName());
  }

  @Test
  void orphanClassificationUsageMapsToUnenrichedLabel() throws SQLException {
    Pair<String, TagLabel> row =
        new TagLabelRowMapperWithTargetFqnHash()
            .map(orphanRow(TagLabel.TagSource.CLASSIFICATION), null);

    assertEquals("g.deletedTerm", row.getRight().getTagFQN());
    assertNull(row.getRight().getName());
  }
}
