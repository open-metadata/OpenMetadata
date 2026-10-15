package org.openmetadata.service.migration.utils.v131;

import static com.cronutils.model.CronType.QUARTZ;

import com.cronutils.mapper.CronMapper;
import com.cronutils.model.Cron;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.parser.CronParser;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  public static void migrateCronExpression(CollectionDAO daoCollection) {
    CronMapper quartzToUnixMapper = CronMapper.fromQuartzToUnix();
    CronParser quartzParser = new CronParser(CronDefinitionBuilder.instanceDefinitionFor(QUARTZ));
    ListFilter filter = new ListFilter(Include.ALL);
    List<String> jsons =
        daoCollection.applicationDAO().listAfter(filter, Integer.MAX_VALUE, "", "");
    for (String jsonStr : jsons) {
      try {
        App application = JsonUtils.readValue(jsonStr, App.class);
        AppSchedule appSchedule = application.getAppSchedule();
        if (appSchedule == null
            || appSchedule.getScheduleTimeline() != ScheduleTimeline.CUSTOM
            || appSchedule.getCronExpression() == null) {
          continue;
        }
        Cron quartzCronExpression = quartzParser.parse(appSchedule.getCronExpression());
        String unixCron = quartzToUnixMapper.map(quartzCronExpression).asString();
        appSchedule.setCronExpression(unixCron);
        daoCollection.applicationDAO().update(application);
      } catch (Exception ex) {
        LOG.warn("Skipping cron migration for an app due to: {}", ex.getMessage());
      }
    }
  }
}
