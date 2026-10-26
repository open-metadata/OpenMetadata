package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.FirstTimeUserMigration;

/**
 * Exercises the 2.1.0 backfill that marks users who signed in or were active before the upgrade as
 * no longer first-time users, against the real database.
 */
@Isolated("runs the 2.1.0 first-time-user backfill over the shared user_entity table")
@ExtendWith(TestNamespaceExtension.class)
class FirstTimeUserMigrationIT {

  private static final String FIELD = "isFirstTimeUser";

  @Test
  void backfillMarksUsersWithALoginOrActivityTime(TestNamespace ns) {
    UUID loggedIn = createPreUpgradeUser(ns, "loggedin");
    UUID activeOnly = createPreUpgradeUser(ns, "activeonly");
    setField(loggedIn, "lastLoginTime", "100");
    setField(activeOnly, "lastActivityTime", "200");

    runBackfill();

    assertEquals("false", readField(loggedIn));
    assertEquals("false", readField(activeOnly), "SSO and token users set only lastActivityTime");
  }

  @Test
  void backfillLeavesNewAndAlreadyFlaggedUsersAloneAndIsIdempotent(TestNamespace ns) {
    UUID neverSignedIn = createPreUpgradeUser(ns, "never");
    UUID alreadyFlagged = createPreUpgradeUser(ns, "flagged");
    setField(neverSignedIn, "lastLoginTime", null);
    setField(neverSignedIn, "lastActivityTime", null);
    setField(alreadyFlagged, "lastLoginTime", "500");
    setField(alreadyFlagged, FIELD, "true");

    runBackfill();
    runBackfill();

    assertNull(readField(neverSignedIn), "a user who never signed in stays a first-time user");
    assertEquals("true", readField(alreadyFlagged), "an existing value is left alone");
  }

  /** A user row as it was stored before 2.1.0, without the flag. */
  private UUID createPreUpgradeUser(TestNamespace ns, String prefix) {
    UUID id = createUser(ns, prefix);
    setField(id, FIELD, null);
    return id;
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
    jdbi().useHandle(handle -> FirstTimeUserMigration.backfillFirstTimeUser(handle, dialect()));
  }

  /** Writes a JSON literal straight into the stored row; {@code null} removes the field. */
  private void setField(UUID id, String field, String jsonValue) {
    String sql =
        switch (dialect()) {
          case MYSQL -> jsonValue == null
              ? "UPDATE user_entity SET json = JSON_REMOVE(json, '$." + field + "') WHERE id = :id"
              : "UPDATE user_entity SET json = JSON_SET(json, '$."
                  + field
                  + "', CAST(:value AS JSON)) WHERE id = :id";
          case POSTGRES -> jsonValue == null
              ? "UPDATE user_entity SET json = json - '" + field + "' WHERE id = :id"
              : "UPDATE user_entity SET json = jsonb_set(json, '{"
                  + field
                  + "}', CAST(:value AS jsonb)) WHERE id = :id";
        };
    jdbi()
        .useHandle(
            handle -> {
              var update = handle.createUpdate(sql).bind("id", id.toString());
              if (jsonValue != null) {
                update.bind("value", jsonValue);
              }
              update.execute();
            });
  }

  private String readField(UUID id) {
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
    return "null".equals(raw) ? null : raw;
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
