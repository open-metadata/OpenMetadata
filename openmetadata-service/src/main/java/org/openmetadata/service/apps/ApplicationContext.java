package org.openmetadata.service.apps;

import java.util.HashMap;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppRepository;

@Slf4j
public class ApplicationContext {
  private static ApplicationContext instance;
  private final HashMap<String, AbstractNativeApplication> apps;

  private ApplicationContext() {
    this.apps = new HashMap<>();
  }

  public static ApplicationContext getInstance() {
    if (instance == null) {
      initialize();
    }
    return instance;
  }

  public static void initialize() {
    if (instance != null) {
      return;
    }
    instance = new ApplicationContext();
    LOG.info("Initializing Application Context");

    AppRepository appRepo = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    List<App> installedApps = appRepo.listAll();
    for (App app : installedApps) {
      try {
        // Initialize the apps. This will already load the context with Collate apps that require it
        AbstractNativeApplication initializedApp =
            ApplicationHandler.getInstance()
                .runAppInit(app, Entity.getCollectionDAO(), Entity.getSearchRepository());
        instance.registerApp(initializedApp);
      } catch (Exception e) {
        LOG.error(
            "Error registering installed app {} during Application Context init", app.getName(), e);
      }
    }
  }

  public void registerApp(AbstractNativeApplication app) {
    this.apps.put(app.getApp().getName(), app);
  }

  public void unregisterApp(AbstractNativeApplication app) {
    this.apps.remove(app.getApp().getName());
  }

  public AbstractNativeApplication getApp(String name) {
    AbstractNativeApplication app = this.apps.get(name);
    if (app == null) {
      throw new IllegalStateException(String.format("App %s needs to be initialized first.", name));
    }
    return app;
  }

  public AbstractNativeApplication getAppIfExists(String name) {
    AbstractNativeApplication app = this.apps.get(name);
    return app;
  }
}
