package org.openmetadata.service.migration.utils.v131;

import static com.cronutils.model.CronType.QUARTZ;

import com.cronutils.mapper.CronMapper;
import com.cronutils.model.Cron;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.parser.CronParser;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
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
    try {
      CronMapper quartzToUnixMapper = CronMapper.fromQuartzToUnix();
      CronParser quartzParser = new CronParser(CronDefinitionBuilder.instanceDefinitionFor(QUARTZ));
      ListFilter filter = new ListFilter(Include.ALL);
      List<String> jsons =
          daoCollection.applicationDAO().listAfter(filter, Integer.MAX_VALUE, "", "");
      for (String jsonStr : jsons) {
        App application = JsonUtils.readValue(jsonStr, App.class);
        String cronExpression = application.getAppSchedule().getCronExpression();
        Cron quartzCronExpression = quartzParser.parse(cronExpression);
        String unixCron = quartzToUnixMapper.map(quartzCronExpression).asString();
        application.getAppSchedule().setCronExpression(unixCron);
        daoCollection.applicationDAO().update(application);
      }
    } catch (IllegalArgumentException e) {
      LOG.warn(
          "Got IllegalArgumentExpr Cron Expression might already be Migrated. Message : {}",
          e.getMessage());
    } catch (Exception ex) {
      LOG.error("Error while migrating cron expression, Logging and moving further", ex);
    }
  }
}
