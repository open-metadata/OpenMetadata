package org.openmetadata.service.ontology;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO;
import org.openmetadata.service.util.RestUtil;

public final class OntologyReleaseHistory {
  private static final String CURSOR_VERSION = "ontology-releases-v1";
  private final OntologyReleaseDAO releases;

  public OntologyReleaseHistory(final OntologyReleaseDAO releases) {
    this.releases = releases;
  }

  public ResultList<OntologyRelease> list(
      final UUID ontologyId, final int limit, final String after) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException("Ontology release page size must be between 1 and 100");
    }
    final Cursor cursor =
        after == null
            ? new Cursor(ontologyId, releases.latestSealedRevision(ontologyId), 0)
            : Cursor.parse(ontologyId, after);
    final List<OntologyRelease> entries =
        releases
            .listChronological(ontologyId, cursor.highWater(), cursor.before(), limit + 1)
            .stream()
            .map(json -> JsonUtils.readValue(json, OntologyRelease.class))
            .toList();
    return page(cursor, entries, limit);
  }

  private ResultList<OntologyRelease> page(
      final Cursor cursor, final List<OntologyRelease> entries, final int limit) {
    final List<OntologyRelease> page =
        List.copyOf(entries.subList(0, Math.min(limit, entries.size())));
    return new ResultList<>(
        page,
        null,
        entries.size() > limit ? cursor.after(page.getLast().getReleaseRevision()) : null,
        releases.countChronological(cursor.ontologyId(), cursor.highWater()));
  }

  record Cursor(UUID ontologyId, long highWater, long before) {
    String after(final long revision) {
      return CURSOR_VERSION + ":" + ontologyId + ":" + highWater + ":" + revision;
    }

    static Cursor parse(final UUID ontologyId, final String after) {
      try {
        final String decoded = after.length() > 256 ? null : RestUtil.decodeCursor(after);
        final String[] parts = decoded == null ? new String[0] : decoded.split(":", -1);
        if (parts.length != 4
            || !CURSOR_VERSION.equals(parts[0])
            || !ontologyId.equals(UUID.fromString(parts[1]))) {
          throw new IllegalArgumentException();
        }
        return requireRange(
            new Cursor(ontologyId, Long.parseLong(parts[2]), Long.parseLong(parts[3])));
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException("Invalid cursor for this ontology release history");
      }
    }

    private static Cursor requireRange(final Cursor cursor) {
      if (cursor.highWater() < 1 || cursor.before() < 1 || cursor.before() > cursor.highWater()) {
        throw new IllegalArgumentException();
      }
      return cursor;
    }
  }
}
