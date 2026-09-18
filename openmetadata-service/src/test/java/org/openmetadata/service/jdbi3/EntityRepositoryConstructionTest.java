package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

class EntityRepositoryConstructionTest {
  static Stream<Arguments> repositories() {
    return Stream.of(
        repository(Entity.TABLE, TableRepository::new),
        repository(Entity.CHART, ChartRepository::new),
        repository(Entity.GLOSSARY_TERM, GlossaryTermRepository::new));
  }

  private static Arguments repository(
      String type, Function<RepositoryDependencies, EntityRepository<?>> construct) {
    return Arguments.of(type, construct);
  }

  @ParameterizedTest
  @MethodSource("repositories")
  void independentlyConstructedRepositoriesKeepTheirDependenciesAndDoNotRegister(
      String type, Function<RepositoryDependencies, EntityRepository<?>> construct) {
    final var registered = registered(type);
    final var firstDependencies = dependencies();
    final var secondDependencies = dependencies();
    final var first = construct.apply(firstDependencies);
    final var second = construct.apply(secondDependencies);
    assertEquals(type, first.getEntityType());
    assertSame(firstDependencies.daoCollection(), first.getDaoCollection());
    assertSame(secondDependencies.daoCollection(), second.getDaoCollection());
    assertSame(firstDependencies.relationshipRepository(), first.getRelationshipRepository());
    assertTrue(first.getFields("owners,tags").contains("owners"));
    assertTrue(first.isSupportsOwners());
    assertSame(registered, registered(type));
  }

  @Test
  void failedSubclassConstructionCannotPublishAnIncompleteRepository() {
    final var registered = registered(Entity.CHART);
    assertThrows(IllegalStateException.class, () -> new FailingChart(dependencies()));
    assertSame(registered, registered(Entity.CHART));
  }

  private RepositoryDependencies dependencies() {
    final var dao = mock(CollectionDAO.class);
    return new RepositoryDependencies(dao, null, null, new EntityRelationshipRepository(dao));
  }

  private EntityRepository<?> registered(String type) {
    try {
      return Entity.getEntityRepository(type);
    } catch (EntityNotFoundException absent) {
      return null;
    }
  }

  private static final class FailingChart extends ChartRepository {
    private FailingChart(RepositoryDependencies dependencies) {
      super(dependencies);
      throw new IllegalStateException("Subclass initialization failed");
    }
  }
}
