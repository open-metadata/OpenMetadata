package org.openmetadata.service.apps;

import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

public interface NativeApplication extends Job {
  void init(App app, CollectionDAO dao, SearchRepository searchRepository);

  void triggerOnDemand();

  void schedule();

  default void startApp(JobExecutionContext jobExecutionContext) {}
}
