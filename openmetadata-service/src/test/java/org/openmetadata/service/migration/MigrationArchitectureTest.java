package org.openmetadata.service.migration;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaCall.Predicates.target;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.assignableTo;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.simpleNameEndingWith;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.type;
import static com.tngtech.archunit.core.domain.properties.HasName.Predicates.nameMatching;
import static com.tngtech.archunit.core.domain.properties.HasOwner.Predicates.With.owner;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.migration.utils.v210.CustomPropertyReferenceMigration;
import org.openmetadata.service.migration.utils.v210.DataContractEntityReferenceMigration;
import org.openmetadata.service.migration.utils.v210.DataQualityDimensionMigration;
import org.openmetadata.service.migration.utils.v210.DeltaLakeRetirementMigration;
import org.openmetadata.service.migration.utils.v210.GlossaryAutomationReviewMigration;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;
import org.openmetadata.service.migration.utils.v210.OntologyRolesMigration;
import org.openmetadata.service.migration.utils.v210.UnsupportedNotificationTemplates;

/**
 * A versioned migration carries its own logic: it reads and writes rows itself instead of calling
 * code that keeps changing after the migration ships. ADR:2026-11-11-a-data-migration-carries-its-own-logic
 */
@AnalyzeClasses(
    packages = "org.openmetadata.service.migration",
    importOptions = ImportOption.DoNotIncludeTests.class)
class MigrationArchitectureTest {

  private static final String MIGRATION = "org.openmetadata.service.migration";
  private static final String SERVICE = "org.openmetadata.service";

  /** The steps of one release: {@code mysql/vNNN}, {@code postgres/vNNN} and {@code utils/vNNN}. */
  private static final DescribedPredicate<JavaClass> VERSIONED_MIGRATIONS =
      resideInAnyPackage(
          MIGRATION + ".mysql.*..", MIGRATION + ".postgres.*..", MIGRATION + ".utils.*..");

  /** The 1.x and 2.0.x releases shipped before this rule and are left as they are. */
  private static final DescribedPredicate<JavaClass> SHIPPED_BEFORE_THE_RULE =
      resideInAnyPackage(MIGRATION + ".*.v1*..", MIGRATION + ".*.V1*..", MIGRATION + ".*.v20*..");

  /**
   * Steps that call platform code. Each line says what it calls. The 2.1.0 steps below were written
   * before this rule; a new exception says why the work cannot be done with rows and SQL instead.
   */
  private static final DescribedPredicate<JavaClass> EXCEPTIONS =
      belongToAnyOf(
          // 2.1.0: resolves entity references by name through the entity registry.
          ConversationMigration.class,
          // 2.1.0: reaches the entity tables through each repository's DAO.
          CustomPropertyReferenceMigration.class,
          // 2.1.0: resolves entity references by id through the entity registry.
          DataContractEntityReferenceMigration.class,
          // 2.1.0: seeds the system dimensions from the current resource files.
          DataQualityDimensionMigration.class,
          // 2.1.0: deletes Delta Lake pipelines through the repository, which also removes them
          // from the pipeline service.
          // ADR:2026-10-13-a-removed-connector-is-retired-in-the-first-data-migration-step
          DeltaLakeRetirementMigration.class,
          // 2.1.0: seeds, stores and deploys workflow definitions through the workflow repository.
          GlossaryAutomationReviewMigration.class,
          // 2.1.0: edits seeded policies, system settings and notification templates through
          // their repositories.
          MigrationUtil.class,
          // 2.1.0: creates and attaches seeded policies through the role and policy repositories.
          OntologyRolesMigration.class,
          // 2.1.0: resets notification templates to the current defaults through the repository.
          UnsupportedNotificationTemplates.class);

  /**
   * Code that keeps changing after a migration ships: repositories, secrets, search, workflows and
   * the pipeline service client.
   */
  private static final DescribedPredicate<JavaClass> PLATFORM_CODE =
      resideInAPackage(SERVICE + ".jdbi3..")
          .and(simpleNameEndingWith("Repository"))
          .or(
              resideInAnyPackage(
                  SERVICE + ".secrets..",
                  SERVICE + ".search..",
                  SERVICE + ".governance.workflows..",
                  SERVICE + ".clients.pipeline.."))
          .or(assignableTo(PipelineServiceClientInterface.class));

  @ArchTest
  static final ArchRule versionedMigrationsDoNotDependOnPlatformCode =
      noClasses()
          .that(VERSIONED_MIGRATIONS)
          .and(not(SHIPPED_BEFORE_THE_RULE))
          .and(not(EXCEPTIONS))
          .should()
          .dependOnClassesThat(PLATFORM_CODE);

  @ArchTest
  static final ArchRule versionedMigrationsDoNotReadEntitiesThroughTheRegistry =
      noClasses()
          .that(VERSIONED_MIGRATIONS)
          .and(not(SHIPPED_BEFORE_THE_RULE))
          .and(not(EXCEPTIONS))
          .should()
          .callMethodWhere(
              target(owner(type(Entity.class)))
                  .and(
                      target(
                          nameMatching(
                              "get(Entity|Entities|EntityByName.*|EntityOrNull|EntityReference.*"
                                  + "|EntityRepository|ServiceEntityRepository|UserRepository"
                                  + "|EntityForInheritance|EntitiesForInheritance|Owners"
                                  + "|EntityTags|Fields|SearchRepo)"))));
}
