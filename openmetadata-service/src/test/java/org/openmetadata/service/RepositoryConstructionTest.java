package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.InvocationTargetException;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.RepositoryDependencies;

class RepositoryConstructionTest {
  private final RepositoryDependencies dependencies =
      new RepositoryDependencies(null, null, null, null);

  @Test
  void explicitDependenciesTakePriorityOverLegacyConstructors()
      throws ReflectiveOperationException {
    final var repository =
        (AllConstructors)
            Entity.constructRepository(AllConstructors.class, dependencies, null, null);
    assertSame(dependencies, repository.argument);
  }

  @Test
  void legacyConstructorSignaturesRemainSupported() throws ReflectiveOperationException {
    final var config = new OpenMetadataApplicationConfig();
    final var jdbi = Jdbi.create("jdbc:unused:construction");
    assertInstanceOf(
        NoArguments.class,
        Entity.constructRepository(NoArguments.class, dependencies, config, jdbi));
    assertSame(
        config,
        ((ConfigurationOnly)
                Entity.constructRepository(ConfigurationOnly.class, dependencies, config, jdbi))
            .argument);
    assertSame(
        jdbi,
        ((JdbiOnly) Entity.constructRepository(JdbiOnly.class, dependencies, config, jdbi))
            .argument);
  }

  @Test
  void constructorFailureDoesNotFallBackToAnotherImplementation() {
    final var failure =
        assertThrows(
            InvocationTargetException.class,
            () -> Entity.constructRepository(Failing.class, dependencies, null, null));
    assertInstanceOf(IllegalStateException.class, failure.getCause());
  }

  @Test
  void unsupportedSignatureFailsBeforeConstruction() {
    assertThrows(
        NoSuchMethodException.class,
        () -> Entity.constructRepository(Unsupported.class, dependencies, null, null));
  }

  static final class AllConstructors {
    private final Object argument;

    public AllConstructors() {
      argument = null;
    }

    public AllConstructors(RepositoryDependencies dependencies) {
      argument = dependencies;
    }
  }

  static final class NoArguments {
    public NoArguments() {}
  }

  static final class ConfigurationOnly {
    private final OpenMetadataApplicationConfig argument;

    public ConfigurationOnly(OpenMetadataApplicationConfig config) {
      argument = config;
    }
  }

  static final class JdbiOnly {
    private final Jdbi argument;

    public JdbiOnly(Jdbi jdbi) {
      argument = jdbi;
    }
  }

  static final class Failing {
    public Failing() {}

    public Failing(RepositoryDependencies dependencies) {
      throw new IllegalStateException("Repository construction failed");
    }
  }

  static final class Unsupported {
    public Unsupported(String argument) {}
  }
}
