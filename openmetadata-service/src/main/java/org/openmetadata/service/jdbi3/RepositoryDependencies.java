package org.openmetadata.service.jdbi3;

import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.search.SearchRepository;

/** Dependencies supplied by the composition root, without publishing a repository during construction. */
public record RepositoryDependencies(
    CollectionDAO daoCollection,
    JobDAO jobDao,
    SearchRepository searchRepository,
    EntityRelationshipRepository relationshipRepository) {
  static RepositoryDependencies legacy() {
    final var dao = Entity.getCollectionDAO();
    return new RepositoryDependencies(
        dao,
        Entity.getJobDAO(),
        Entity.getSearchRepository(),
        new EntityRelationshipRepository(dao));
  }
}
