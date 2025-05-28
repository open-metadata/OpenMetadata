package org.openmetadata.service.migration.context;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/*
Given a query - that should return a single column with a count, compute the validation and store its value.
*/
@Slf4j
public class MigrationOps {

  @NotEmpty @Getter private final String name;
  @NotEmpty @Getter private final String query;
  @Getter @Setter private Long result;

  public MigrationOps(String name, String query) {
    this.name = name;
    this.query = query;
  }

  public void compute(Handle handle) {
    try {
      this.result = handle.createQuery(query).mapTo(Long.class).one();
    } catch (Exception ex) {
      LOG.warn(String.format("Migration Op [%s] failed due to [%s]", name, ex));
    }
  }
}
