package org.openmetadata.service.migration;

import static com.tngtech.archunit.base.DescribedPredicate.alwaysFalse;
import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaCall.Predicates.target;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.assignableTo;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.core.domain.properties.HasName.Predicates.nameMatching;
import static com.tngtech.archunit.core.domain.properties.HasOwner.Predicates.With.owner;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcess;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.MigrationTableUtil;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * A versioned migration carries its own logic: it may use only the classes listed here, so code
 * added to the product later cannot slip into a step unnoticed.
 * ADR:2026-11-11-a-data-migration-carries-its-own-logic
 */
@AnalyzeClasses(
    packages = "org.openmetadata.service.migration",
    importOptions = ImportOption.DoNotIncludeTests.class)
class MigrationArchitectureTest {

  private static final String MIGRATION = "org.openmetadata.service.migration";

  /** The steps of one release: {@code mysql/vNNN}, {@code postgres/vNNN} and {@code utils/vNNN}. */
  private static final DescribedPredicate<JavaClass> VERSIONED_MIGRATIONS =
      resideInAnyPackage(
          MIGRATION + ".mysql.*..", MIGRATION + ".postgres.*..", MIGRATION + ".utils.*..");

  /**
   * The 1.x, 2.0.0 to 2.0.9 and 2.1.0 steps were written before this rule and are left as they are.
   * The 2.0.10 steps ({@code v2010}) came after it and are checked.
   */
  private static final DescribedPredicate<JavaClass> WRITTEN_BEFORE_THE_RULE =
      resideInAnyPackage(
          MIGRATION + ".*.v1*..",
          MIGRATION + ".*.V1*..",
          MIGRATION + ".*.[v200|v201|v202|v203|v204|v205|v206|v207|v208|v209]..",
          MIGRATION + ".*.v210..");

  /**
   * Steps that may use more than the allowed classes. Each entry says what it uses and why the work
   * cannot be done with rows and SQL instead.
   */
  private static final DescribedPredicate<JavaClass> EXCEPTIONS = alwaysFalse();

  private static final DescribedPredicate<JavaClass> CHECKED_STEPS =
      VERSIONED_MIGRATIONS.and(not(WRITTEN_BEFORE_THE_RULE)).and(not(EXCEPTIONS));

  /** Libraries that do not follow the product: the JDK, JDBI, Jackson, logging and crypto. */
  private static final DescribedPredicate<JavaClass> LIBRARIES =
      resideInAnyPackage(
          "java..",
          "org.jdbi..",
          "com.fasterxml.jackson..",
          "org.slf4j..",
          "lombok..",
          "com.macasaet.fernet..",
          "org.bouncycastle..");

  /** What runs a step: its base class, its file, its dialect and the run-once log. */
  private static final DescribedPredicate<JavaClass> FRAMEWORK =
      belongToAnyOf(
          MigrationProcess.class,
          MigrationProcessImpl.class,
          MigrationFile.class,
          ConnectionType.class,
          MigrationDAO.class,
          DataMigrationStep.class,
          IdBatches.class,
          MigrationTableUtil.class);

  /** Formats the stored data must match, so a step uses the shared code for them. */
  private static final DescribedPredicate<JavaClass> CONTRACTS =
      belongToAnyOf(
          FullyQualifiedName.class,
          Fernet.class,
          MessageParser.class,
          JsonUtils.class,
          Relationship.class);

  @ArchTest
  static final ArchRule versionedMigrationsUseOnlyAllowedClasses =
      classes()
          .that(CHECKED_STEPS)
          .should()
          .onlyDependOnClassesThat(CHECKED_STEPS.or(LIBRARIES).or(FRAMEWORK).or(CONTRACTS))
          .as("A versioned migration step uses only the classes MigrationArchitectureTest allows");

  @ArchTest
  static final ArchRule versionedMigrationsDoNotReachWorkflowsThroughTheirBaseClass =
      noClasses()
          .that(CHECKED_STEPS)
          .should()
          .callMethodWhere(
              target(owner(assignableTo(MigrationProcessImpl.class)))
                  .and(target(nameMatching("initializeWorkflowHandler|getPipelineServiceClient"))))
          .as(
              "A versioned migration step does not reach workflows or pipelines from its base class");
}
