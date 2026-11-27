package org.openmetadata.service.resources.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.NoopAuthorizer;
import org.slf4j.LoggerFactory;

class ServiceEntityResourceTest {
  private static final String SECRET_SENTINEL = "synthetic-secret-must-not-be-logged";

  @Test
  void listFailurePreservesEnvelopeAndReturnedEntities() {
    final TestResource resource = createResource();
    final DatabaseService healthy = service("healthy");
    final DatabaseService broken = service("broken");
    final DatabaseService later = service("later");
    resource.processor =
        service -> {
          if (service.getId().equals(broken.getId())) {
            throw new InvalidServiceConnectionException(SECRET_SENTINEL);
          }
          return JsonUtils.deepCopy(service, DatabaseService.class).withDisplayName("processed");
        };
    final ResultList<DatabaseService> page =
        new ResultList<>(List.of(healthy, broken, later), "before", "after", 9);
    final List<EntityError> errors = List.of(new EntityError());
    final List<EntityError> warnings = List.of(new EntityError());
    final Map<String, ResourcePermission> permissions =
        Map.of(broken.getId().toString(), new ResourcePermission());
    page.setErrors(errors);
    page.setWarnings(warnings);
    page.setWarningsCount(1);
    page.setEntityPermissions(permissions);
    final String paging = JsonUtils.pojoToJson(page.getPaging());

    assertSame(page, resource.decryptOrNullify(null, page));
    assertEquals(
        List.of(healthy.getId(), broken.getId(), later.getId()),
        page.getData().stream().map(DatabaseService::getId).toList());
    assertEquals("processed", page.getData().getFirst().getDisplayName());
    assertNull(page.getData().get(1).getConnection());
    assertEquals("processed", page.getData().getLast().getDisplayName());
    assertNotNull(broken.getConnection());
    assertEquals(paging, JsonUtils.pojoToJson(page.getPaging()));
    assertSame(errors, page.getErrors());
    assertSame(warnings, page.getWarnings());
    assertEquals(1, page.getWarningsCount());
    assertSame(permissions, page.getEntityPermissions());
  }

  @Test
  void warningDoesNotExposeExceptionTextOrThrowable() {
    final TestResource resource = createResource();
    resource.processor =
        service -> {
          throw new InvalidServiceConnectionException(SECRET_SENTINEL);
        };
    final DatabaseService broken = service("broken");
    final Logger logger = (Logger) LoggerFactory.getLogger(ServiceEntityResource.class);
    final ListAppender<ILoggingEvent> events = new ListAppender<>();
    events.start();
    logger.addAppender(events);
    try {
      resource.decryptOrNullify(null, new ResultList<>(List.of(broken)));
      assertEquals(1, events.list.size());
      final ILoggingEvent warning = events.list.getFirst();
      assertTrue(warning.getFormattedMessage().contains(broken.getId().toString()));
      assertFalse(warning.getFormattedMessage().contains(SECRET_SENTINEL));
      assertNull(warning.getThrowableProxy());
    } finally {
      logger.detachAppender(events);
      events.stop();
    }
  }

  @ParameterizedTest
  @MethodSource("unrelatedFailures")
  void unrelatedFailuresStillPropagate(RuntimeException failure) {
    final TestResource resource = createResource();
    resource.processor =
        service -> {
          throw failure;
        };
    assertSame(
        failure,
        assertThrows(
            failure.getClass(),
            () -> resource.decryptOrNullify(null, new ResultList<>(List.of(service("service"))))));
  }

  private static Stream<RuntimeException> unrelatedFailures() {
    return Stream.of(
        new AuthorizationException("denied"),
        new EntityMaskException("mask failed"),
        new IllegalStateException("unexpected failure"));
  }

  @Test
  void emptyAndNullDataRetainTheirContract() {
    final TestResource resource = createResource();
    final ResultList<DatabaseService> empty = new ResultList<>(List.of());
    final ResultList<DatabaseService> absent = new ResultList<>();
    assertSame(empty, resource.decryptOrNullify(null, empty));
    assertTrue(empty.getData().isEmpty());
    assertSame(absent, resource.decryptOrNullify(null, absent));
    assertNull(absent.getData());
  }

  private static DatabaseService service(String name) {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withServiceType(DatabaseServiceType.Postgres)
        .withConnection(new DatabaseConnection());
  }

  private static TestResource createResource() {
    final DatabaseServiceRepository repository = mock(DatabaseServiceRepository.class);
    when(repository.getAllowedFields()).thenReturn(Set.of());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SERVICE))
          .thenReturn(repository);
      entities
          .when(() -> Entity.getEntityClassFromType(Entity.DATABASE_SERVICE))
          .thenReturn(DatabaseService.class);
      entities
          .when(() -> Entity.getServiceEntityRepository(ServiceType.DATABASE))
          .thenReturn(repository);
      return new TestResource();
    }
  }

  private static class TestResource
      extends ServiceEntityResource<
          DatabaseService, DatabaseServiceRepository, DatabaseConnection> {
    private UnaryOperator<DatabaseService> processor = UnaryOperator.identity();

    private TestResource() {
      super(Entity.DATABASE_SERVICE, new NoopAuthorizer(), null, ServiceType.DATABASE);
    }

    @Override
    protected DatabaseService decryptOrNullify(SecurityContext context, DatabaseService service) {
      return processor.apply(service);
    }

    @Override
    protected DatabaseService nullifyConnection(DatabaseService service) {
      return JsonUtils.deepCopy(service, DatabaseService.class).withConnection(null);
    }

    @Override
    protected String extractServiceType(DatabaseService service) {
      return service.getServiceType().value();
    }
  }
}
