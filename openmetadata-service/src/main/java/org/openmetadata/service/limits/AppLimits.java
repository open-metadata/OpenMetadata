package org.openmetadata.service.limits;

import javax.ws.rs.core.SecurityContext;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
public abstract class AppLimits {

  private final CollectionDAO.AppExtensionTimeSeries dao;
  private final @Getter AppRepository repository;
  private @Getter App app;

  public AppLimits(CollectionDAO collectionDAO) {
    this.dao = collectionDAO.appExtensionTimeSeriesDao();
    this.repository = new AppRepository();
  }

  // This can only happen with runtime loaded apps with the private config
  public void init(App app) {
    this.app = app;
    try {
      parseAppLimits();
    } catch (Exception e) {
      LOG.error("Error parsing limits config file: {}", e.getMessage());
    }
  }

  public AppExtension getLatestLimit() {
    return repository.getLatestExtension(
        this.app, true, AppExtension.class, AppExtension.ExtensionType.LIMITS);
  }

  public AppExtension getLatestLimit(long startTime) {
    return repository.getLatestExtensionAfterStartTime(
        this.app, true, startTime, AppExtension.class, AppExtension.ExtensionType.LIMITS);
  }

  public ResultList<AppExtension> listLimits(int limitParam, int offset) {
    return repository.listAppExtension(
        this.app, true, limitParam, offset, AppExtension.class, AppExtension.ExtensionType.LIMITS);
  }

  public ResultList<AppExtension> listAllLimits() {
    return repository.listAllAppExtension(
        this.app, true, AppExtension.class, AppExtension.ExtensionType.LIMITS);
  }

  public void insertLimit(AppExtension limitsExtension) {
    try {
      if (limitsExtension.getAppId() != getApp().getId()) {
        LOG.error(
            "App ID mismatch. You can't manage limits from another app: {} != {}",
            limitsExtension.getAppId(),
            getApp().getId());
        return;
      }
      // Ensure the passed extension is an updated limit
      limitsExtension.setTimestamp(System.currentTimeMillis());
      limitsExtension.setExtension(AppExtension.ExtensionType.LIMITS);
      this.dao.insert(
          JsonUtils.pojoToJson(limitsExtension), AppExtension.ExtensionType.LIMITS.toString());
    } catch (Exception e) {
      LOG.error("Error inserting app limits for {}: {}", this.getApp().getName(), e.getMessage());
    }
  }

  // Parse the app limits defined in the Private Configuration
  // Let each App parse and store however is needed
  public abstract void parseAppLimits() throws Exception;

  // Enforce limits for the app
  public abstract void enforceLimits(
      SecurityContext securityContext,
      ResourceContextInterface resourceContext,
      OperationContext operationContext);
}
