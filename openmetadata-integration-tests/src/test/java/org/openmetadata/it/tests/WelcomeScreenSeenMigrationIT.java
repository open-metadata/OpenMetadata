package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WelcomeScreenSeenMigration;

/**
 * Exercises the 2.1.0 backfill that marks the first-login welcome screen as seen for users who
 * signed in or were active before the upgrade, against the real database.
 */
// The backfill rewrites every user_entity row it matches, so these tests must not interleave.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class WelcomeScreenSeenMigrationIT {

  private static final String FIELD = "welcomeScreenSeenAt";

  @Test
  void backfillUsesTheLoginTimeAndFallsBackToActivity(TestNamespace ns) {
    UUID loggedIn = createUser(ns, "loggedin");
    UUID activeOnly = createUser(ns, "activeonly");
    UUID both = createUser(ns, "both");
    setField(loggedIn, "lastLoginTime", 100L);
    setField(activeOnly, "lastActivityTime", 200L);
    setField(both, "lastLoginTime", 300L);
    setField(both, "lastActivityTime", 400L);

    runBackfill();

    assertEquals(100L, readField(loggedIn));
    assertEquals(200L, readField(activeOnly), "SSO and token users set only lastActivityTime");
    assertEquals(300L, readField(both), "the login time wins over activity");
  }

  @Test
  void backfillLeavesNewAndAlreadyMarkedUsersAloneAndIsIdempotent(TestNamespace ns) {
    UUID neverSignedIn = createUser(ns, "never");
    UUID alreadySeen = createUser(ns, "seen");
    setField(neverSignedIn, "lastLoginTime", null);
    setField(neverSignedIn, "lastActivityTime", null);
    setField(alreadySeen, "lastLoginTime", 500L);
    setField(alreadySeen, FIELD, 7L);

    runBackfill();
    runBackfill();

    assertNull(readField(neverSignedIn), "a user who never signed in still sees the screen");
    assertEquals(7L, readField(alreadySeen), "an existing value is left alone");
  }

  private UUID createUser(TestNamespace ns, String prefix) {
    String name = ns.prefix(prefix).toLowerCase().replaceAll("[^a-z0-9]", "");
    User user =
        SdkClients.adminClient()
            .users()
            .create(new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org"));
    return user.getId();
  }

  private void runBackfill() {
    jdbi()
        .useHandle(
            handle -> WelcomeScreenSeenMigration.backfillWelcomeScreenSeen(handle, dialect()));
  }

  /** Writes the field straight into the stored row; {@code null} removes it. */
  private void setField(UUID id, String field, Long value) {
    String sql =
        switch (dialect()) {
          case MYSQL -> value == null
              ? "UPDATE user_entity SET json = JSON_REMOVE(json, '$." + field + "') WHERE id = :id"
              : "UPDATE user_entity SET json = JSON_SET(json, '$."
                  + field
                  + "', :value)"
                  + " WHERE id = :id";
          case POSTGRES -> value == null
              ? "UPDATE user_entity SET json = json - '" + field + "' WHERE id = :id"
              : "UPDATE user_entity SET json = jsonb_set(json, '{"
                  + field
                  + "}',"
                  + " to_jsonb(CAST(:value AS bigint))) WHERE id = :id";
        };
    jdbi()
        .useHandle(
            handle -> {
              var update = handle.createUpdate(sql).bind("id", id.toString());
              if (value != null) {
                update.bind("value", value);
              }
              update.execute();
            });
  }

  private Long readField(UUID id) {
    String projection =
        dialect() == ConnectionType.MYSQL
            ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$." + FIELD + "'))"
            : "json ->> '" + FIELD + "'";
    String raw =
        jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT " + projection + " FROM user_entity WHERE id = :id")
                        .bind("id", id.toString())
                        .mapTo(String.class)
                        .findOne()
                        .orElse(null));
    return raw == null || "null".equals(raw) ? null : Long.valueOf(raw);
  }

  private Jdbi jdbi() {
    return TestSuiteBootstrap.getJdbi();
  }

  private ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
