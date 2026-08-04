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

package org.openmetadata.service.ontology;

import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.ServiceUnavailableException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAnnexRevision;
import org.openmetadata.schema.type.OntologyAnnexSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyAnnexRow;

@Slf4j
public final class OntologyAnnexService {
  private static final int MAX_INSERT_ATTEMPTS = 3;
  private final CollectionDAO.OntologyAnnexDAO annexDAO;
  private final RdfBlankNodeCanonicalizer canonicalizer;
  private final Clock clock;
  private final Function<UUID, EntityReference> glossaryReferenceResolver;

  public OntologyAnnexService(
      final CollectionDAO.OntologyAnnexDAO annexDAO,
      final RdfBlankNodeCanonicalizer canonicalizer,
      final Clock clock) {
    this(
        annexDAO,
        canonicalizer,
        clock,
        glossaryId -> Entity.getEntityReferenceById(Entity.GLOSSARY, glossaryId, Include.ALL));
  }

  OntologyAnnexService(
      final CollectionDAO.OntologyAnnexDAO annexDAO,
      final RdfBlankNodeCanonicalizer canonicalizer,
      final Clock clock,
      final Function<UUID, EntityReference> glossaryReferenceResolver) {
    this.annexDAO = annexDAO;
    this.canonicalizer = canonicalizer;
    this.clock = clock;
    this.glossaryReferenceResolver = glossaryReferenceResolver;
  }

  public OntologyAnnexRevision preserve(
      final UUID glossaryId,
      final Model sourceModel,
      final Model representedModel,
      final OntologyAnnexSource source,
      final String user) {
    final Model annexModel = sourceModel.difference(representedModel);
    final String canonicalNQuads;
    try {
      canonicalNQuads = canonicalizer.canonicalize(annexModel);
    } finally {
      annexModel.close();
    }
    return preserve(glossaryId, canonicalNQuads, source, user);
  }

  public OntologyAnnexRevision preserve(
      final UUID glossaryId,
      final String canonicalNQuads,
      final OntologyAnnexSource source,
      final String user) {
    final String checksum = canonicalizer.checksum(canonicalNQuads);
    OntologyAnnexRow row = annexDAO.findByChecksum(glossaryId, checksum);
    int attempt = 0;
    while (row == null && attempt < MAX_INSERT_ATTEMPTS) {
      attempt++;
      row = insertRevision(glossaryId, canonicalNQuads, checksum, source, user);
    }
    return toRevision(requireRevision(row, glossaryId));
  }

  private static OntologyAnnexRow requireRevision(
      final OntologyAnnexRow row, final UUID glossaryId) {
    if (row == null) {
      throw new ServiceUnavailableException(
          "Could not allocate an ontology annex revision for glossary '" + glossaryId + "'");
    }
    return row;
  }

  private OntologyAnnexRow insertRevision(
      final UUID glossaryId,
      final String canonicalNQuads,
      final String checksum,
      final OntologyAnnexSource source,
      final String user) {
    OntologyAnnexRow row = null;
    final long revision = annexDAO.nextRevision(glossaryId);
    final OntologyAnnexRow candidate =
        new OntologyAnnexRow(
            glossaryId, revision, canonicalNQuads, checksum, source.value(), user, clock.millis());
    try {
      annexDAO.insert(candidate);
      row = candidate;
    } catch (UnableToExecuteStatementException exception) {
      LOG.warn(
          "Ontology annex insert failed for glossary '{}' revision {}; retrying via checksum lookup",
          glossaryId,
          revision,
          exception);
      row = annexDAO.findByChecksum(glossaryId, checksum);
    }
    return row;
  }

  public OntologyAnnexRevision latest(final UUID glossaryId) {
    final OntologyAnnexRow row = annexDAO.findLatest(glossaryId);
    if (row == null) {
      throw new NotFoundException(
          "No ontology annex revision exists for glossary '" + glossaryId + "'");
    }
    return toRevision(row);
  }

  public List<OntologyAnnexRevision> list(final UUID glossaryId, final int limit) {
    return annexDAO.list(glossaryId, limit).stream().map(this::toRevision).toList();
  }

  private OntologyAnnexRevision toRevision(final OntologyAnnexRow row) {
    final EntityReference glossary = glossaryReferenceResolver.apply(row.glossaryId());
    return new OntologyAnnexRevision()
        .withGlossary(glossary)
        .withRevision(Math.toIntExact(row.revision()))
        .withCanonicalNQuads(row.canonicalNQuads())
        .withChecksum(row.checksum())
        .withSource(OntologyAnnexSource.fromValue(row.source()))
        .withCreatedBy(row.createdBy())
        .withCreatedAt(row.createdAt());
  }
}
