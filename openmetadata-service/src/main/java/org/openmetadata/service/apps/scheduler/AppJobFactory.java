package org.openmetadata.service.apps.scheduler;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.simpl.SimpleJobFactory;
import org.quartz.spi.TriggerFiredBundle;

@Slf4j
public class AppJobFactory extends SimpleJobFactory {
  private static final ConcurrentHashMap<String, Job> jobMap = new ConcurrentHashMap<>();
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;

  public AppJobFactory(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super();
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  public Job newJob(TriggerFiredBundle bundle, Scheduler scheduler) throws SchedulerException {
    JobDetail jobDetail = bundle.getJobDetail();
    JobDataMap jobDataMap = bundle.getJobDetail().getJobDataMap();
    App jobApp = JsonUtils.readOrConvertValue(jobDataMap.get(APP_INFO_KEY), App.class);
    Class<? extends Job> jobClass = jobDetail.getJobClass();

    try {
      if (jobMap.containsKey(jobApp.getClassName())) {
        LOG.debug(
            "Using store instance of Job '"
                + jobDetail.getKey()
                + "', class="
                + jobClass.getName());

        return jobMap.get(jobDetail.getKey().getName());
      } else {
        LOG.debug(
            "Producing instance of Job '" + jobDetail.getKey() + "', class=" + jobClass.getName());
        Job instance =
            jobClass
                .getDeclaredConstructor(CollectionDAO.class, SearchRepository.class)
                .newInstance(collectionDAO, searchRepository);
        // Call init Method
        Method initMethod = instance.getClass().getMethod("init", App.class);
        initMethod.invoke(instance, jobApp);

        jobMap.put(jobApp.getClassName(), instance);
        return instance;
      }
    } catch (Exception ex) {
      throw new SchedulerException(
          "Problem instantiating class '" + jobDetail.getJobClass().getName() + "'", ex);
    }
  }

  public void removeJob(String className)
      throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
    if (jobMap.containsKey(className)) {
      Job instance = jobMap.get(className);
      // Call init Method
      Method initMethod = instance.getClass().getMethod("shutDown");
      initMethod.invoke(instance);

      // Remove it from the map
      jobMap.remove(className);
    }
  }
}
