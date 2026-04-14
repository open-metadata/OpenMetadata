package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.Scheduler;
import sun.misc.Unsafe;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppSchedulerStopTest {

  @Mock private Scheduler mockScheduler;
  @Mock private ApplicationHandler applicationHandler;
  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;

  private AppScheduler appScheduler;

  @BeforeEach
  void setUp() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);
    appScheduler = (AppScheduler) unsafe.allocateInstance(AppScheduler.class);

    Field schedulerField = AppScheduler.class.getDeclaredField("scheduler");
    schedulerField.setAccessible(true);
    schedulerField.set(appScheduler, mockScheduler);
  }

  private boolean invokeTryStopViaApp(App app) throws Exception {
    Method method = AppScheduler.class.getDeclaredMethod("tryStopViaApp", App.class);
    method.setAccessible(true);
    return (boolean) method.invoke(appScheduler, app);
  }

  @Test
  void tryStopViaApp_returnsTrueWhenAppStopsSuccessfully() throws Exception {
    App app = new App().withName("SearchIndexingApplication");
    AbstractNativeApplication mockAppInstance = mock(AbstractNativeApplication.class);
    when(mockAppInstance.tryStopOutsideQuartz()).thenReturn(true);

    try (MockedStatic<ApplicationHandler> ahMock = mockStatic(ApplicationHandler.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ahMock.when(ApplicationHandler::getInstance).thenReturn(applicationHandler);
      when(applicationHandler.runAppInit(eq(app), any(), any(), eq(true)))
          .thenReturn(mockAppInstance);
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      assertTrue(invokeTryStopViaApp(app));
    }
  }

  @Test
  void tryStopViaApp_returnsFalseWhenAppDoesNotStop() throws Exception {
    App app = new App().withName("SearchIndexingApplication");
    AbstractNativeApplication mockAppInstance = mock(AbstractNativeApplication.class);
    when(mockAppInstance.tryStopOutsideQuartz()).thenReturn(false);

    try (MockedStatic<ApplicationHandler> ahMock = mockStatic(ApplicationHandler.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ahMock.when(ApplicationHandler::getInstance).thenReturn(applicationHandler);
      when(applicationHandler.runAppInit(eq(app), any(), any(), eq(true)))
          .thenReturn(mockAppInstance);
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      assertFalse(invokeTryStopViaApp(app));
    }
  }

  @Test
  void tryStopViaApp_returnsFalseOnException() throws Exception {
    App app = new App().withName("SearchIndexingApplication");

    try (MockedStatic<ApplicationHandler> ahMock = mockStatic(ApplicationHandler.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      ahMock.when(ApplicationHandler::getInstance).thenReturn(applicationHandler);
      when(applicationHandler.runAppInit(eq(app), any(), any(), eq(true)))
          .thenThrow(new RuntimeException("init failed"));
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      assertFalse(invokeTryStopViaApp(app));
    }
  }
}
