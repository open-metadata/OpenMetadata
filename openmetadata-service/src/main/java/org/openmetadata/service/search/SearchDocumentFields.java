package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_VOTES;

import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Votes;

/** Derived fields must use the same values in partial updates and complete documents. */
public final class SearchDocumentFields {
  public static final String DESCRIPTION_STATUS = "descriptionStatus";
  public static final String DESCRIPTION_SOURCES = "descriptionSources";
  public static final String TOTAL_VOTES = "totalVotes";

  private SearchDocumentFields() {}

  public static String descriptionStatus(final EntityInterface<?> entity) {
    return nullOrEmpty(entity.getDescription()) ? "INCOMPLETE" : "COMPLETE";
  }

  public static Map<String, Integer> descriptionSources(final EntityInterface<?> entity) {
    return SearchIndexUtils.processDescriptionSources(
        entity, SearchIndexUtils.getChangeSummaryMap(entity));
  }

  public static void populateVotes(final Map<String, Object> document, final Votes votes) {
    final int upVotes = votes == null || votes.getUpVotes() == null ? 0 : votes.getUpVotes();
    final int downVotes = votes == null || votes.getDownVotes() == null ? 0 : votes.getDownVotes();
    document.put(TOTAL_VOTES, Math.max(upVotes - downVotes, 0));
    if (votes != null) {
      document.put(FIELD_VOTES, Map.of("upVotes", upVotes, "downVotes", downVotes));
    }
  }
}
