package org.openmetadata.service.apps.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.Job;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.simpl.SimpleJobFactory;
import org.quartz.spi.TriggerFiredBundle;

@Slf4j
public class CustomJobFactory extends SimpleJobFactory {
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;

  public CustomJobFactory(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super();
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  public Job newJob(TriggerFiredBundle bundle, Scheduler Scheduler) throws SchedulerException {
    JobDetail jobDetail = bundle.getJobDetail();
    Class<? extends Job> jobClass = jobDetail.getJobClass();

    try {
      LOG.debug(
          "Producing instance of Job '" + jobDetail.getKey() + "', class=" + jobClass.getName());

      return jobClass
          .getDeclaredConstructor(CollectionDAO.class, SearchRepository.class)
          .newInstance(collectionDAO, searchRepository);
    } catch (Exception var7) {
      throw new SchedulerException(
          "Problem instantiating class '" + jobDetail.getJobClass().getName() + "'", var7);
    }
  }
}
