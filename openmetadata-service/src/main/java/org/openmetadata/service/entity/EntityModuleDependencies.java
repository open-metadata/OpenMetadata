package org.openmetadata.service.entity;

import java.time.Clock;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.search.SearchRepository;

/**
 * Infrastructure retained by every component of one entity module.
 */
public record EntityModuleDependencies(
    CollectionDAO daos, JobDAO jobs, SearchRepository search, Jdbi jdbi, Clock clock) {

  public static EntityModuleDependencies standard() {
    return new EntityModuleDependencies(
        Entity.getCollectionDAO(),
        Entity.getJobDAO(),
        Entity.getSearchRepository(),
        Entity.getJdbi(),
        Clock.systemUTC());
  }
}
