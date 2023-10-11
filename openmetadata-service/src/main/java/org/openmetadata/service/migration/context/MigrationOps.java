package org.openmetadata.service.migration.context;

import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/*
Given a query - that should result a single column named `result` -
compute the validation and store its value.
*/
@Slf4j
public class MigrationOps {

  private static final String RESULT_NAME = "result";

  @NotEmpty @Getter private final String name;
  @NotEmpty @Getter private final String query;
  @Getter @Setter private Long result;

  public MigrationOps(String name, String query) {
    this.name = name;
    this.query = query;
  }

  public void compute(Handle handle) {
    try {
      this.result = (Long) handle.createQuery(query).mapToMap().first().get(RESULT_NAME);
    } catch (Exception ex) {
      LOG.warn(String.format("Migration Op [%s] failed due to [%s]", name, ex));
    }
  }
}
