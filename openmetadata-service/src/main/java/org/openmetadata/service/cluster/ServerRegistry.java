/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.cluster;

import io.dropwizard.lifecycle.Managed;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Which servers are alive, which version each runs, and which cross-server protocols each one
 * supports, so a protocol change waits until every live server follows it.
 *
 * <p>Liveness comes from the Quartz cluster table that every server of any version already
 * writes: its app scheduler checks in to {@code QRTZ_SCHEDULER_STATE} every few seconds. A server
 * from before this registry checks in there but never registers here, so it lacks every
 * capability, which is what a rolling upgrade needs to see. See
 * ADR:2026-10-29-cross-server-protocols-wait-until-every-live-server-supports-them.
 */
@Slf4j
public final class ServerRegistry implements ClusterCapabilities, Managed {
  private static final Duration HEARTBEAT = Duration.ofSeconds(30);
  // A registration this old belongs to a server that stopped heartbeating.
  private static final Duration REGISTRATION_TTL = HEARTBEAT.multipliedBy(4);
  // Quartz checks in every few seconds; the margin makes clock skew err towards waiting.
  private static final Duration CHECK_IN_MARGIN = Duration.ofMinutes(1);
  private static final Duration RETENTION = Duration.ofDays(7);
  private static final String CAPABILITIES =
      JsonUtils.pojoToJson(Arrays.stream(ServerCapability.values()).map(Enum::name).toList());
  private static final String CHECK_INS =
      "SELECT INSTANCE_NAME, LAST_CHECKIN_TIME, CHECKIN_INTERVAL FROM QRTZ_SCHEDULER_STATE"
          + " WHERE SCHED_NAME = :scheduler";
  private static final String REGISTRATIONS =
      "SELECT instanceId, version, capabilities, lastHeartbeat FROM server_registry";
  private static final String TOUCH =
      "UPDATE server_registry SET serverId = :serverId, version = :version,"
          + " capabilities = :capabilities, lastHeartbeat = :now WHERE instanceId = :instanceId";
  private static final String REGISTER =
      "INSERT INTO server_registry (instanceId, serverId, version, capabilities, startedAt,"
          + " lastHeartbeat) VALUES (:instanceId, :serverId, :version, :capabilities, :now, :now)";
  private static final String PRUNE = "DELETE FROM server_registry WHERE lastHeartbeat < :cutoff";
  private static final Set<String> NOT_REGISTERED =
      Set.of("this server, which is not registered yet");

  private final Jdbi jdbi;
  private final Clock clock;
  private final Callable<ClusterIdentity> identity;
  private final String serverId;
  private final String version;
  private final ScheduledExecutorService heartbeats =
      Executors.newSingleThreadScheduledExecutor(
          Thread.ofPlatform().daemon().name("server-registry").factory());
  private volatile String instanceId;
  private volatile String schedulerName;
  private volatile boolean registered;

  /**
   * @param identity this server's app scheduler, read once it runs: the Quartz cluster knows every
   *     server by it
   */
  public ServerRegistry(
      final Jdbi jdbi,
      final Clock clock,
      final Callable<ClusterIdentity> identity,
      final String serverId,
      final String version) {
    this.jdbi = jdbi;
    this.clock = clock;
    this.identity = identity;
    this.serverId = serverId;
    this.version = version;
  }

  /** Registers this server once the app scheduler, which identifies it in the cluster, runs. */
  @Override
  public void start() {
    try {
      final ClusterIdentity self = identity.call();
      instanceId = self.instanceId();
      schedulerName = self.schedulerName();
      heartbeat();
      registered = true;
      heartbeats.scheduleWithFixedDelay(
          this::heartbeatQuietly, HEARTBEAT.toSeconds(), HEARTBEAT.toSeconds(), TimeUnit.SECONDS);
      LOG.info("Registered server {} (version {}) with {}", instanceId, version, CAPABILITIES);
    } catch (Exception exception) {
      // Features that need every server's support wait instead; the server itself keeps running.
      LOG.error(
          "Could not register this server; cluster-wide protocol changes stay off", exception);
    }
  }

  @Override
  public void stop() {
    heartbeats.shutdownNow();
  }

  /** Until this server is registered, nothing can be proven, so it reports itself as lacking. */
  @Override
  public Set<String> serversLacking(final ServerCapability capability) {
    final long now = clock.millis();
    return registered
        ? jdbi.withHandle(
            handle -> lacking(checkIns(handle), registrations(handle), capability, now))
        : NOT_REGISTERED;
  }

  static Set<String> lacking(
      final List<CheckIn> checkIns,
      final Map<String, Registration> registrations,
      final ServerCapability capability,
      final long now) {
    final Set<String> lacking = new TreeSet<>();
    for (final CheckIn checkIn : checkIns) {
      final Registration registration = registrations.get(checkIn.instance());
      final boolean supported = registration != null && registration.supports(capability, now);
      if (checkIn.isLive(now) && !supported) {
        lacking.add(describe(checkIn, registration));
      }
    }
    return lacking;
  }

  private static String describe(final CheckIn checkIn, final Registration registration) {
    return registration == null
        ? checkIn.instance() + " (not registered: older than the server registry)"
        : checkIn.instance() + " (version " + registration.version() + ")";
  }

  private List<CheckIn> checkIns(final Handle handle) {
    return handle
        .createQuery(CHECK_INS)
        .bind("scheduler", schedulerName)
        .map(
            (row, context) ->
                new CheckIn(
                    row.getString("INSTANCE_NAME"),
                    row.getLong("LAST_CHECKIN_TIME"),
                    row.getLong("CHECKIN_INTERVAL")))
        .list();
  }

  private static Map<String, Registration> registrations(final Handle handle) {
    return handle
        .createQuery(REGISTRATIONS)
        .map(
            (row, context) ->
                Map.entry(
                    row.getString("instanceId"),
                    new Registration(
                        row.getString("version"),
                        JsonUtils.readObjects(row.getString("capabilities"), String.class),
                        row.getLong("lastHeartbeat"))))
        .stream()
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private void heartbeatQuietly() {
    try {
      heartbeat();
    } catch (RuntimeException exception) {
      LOG.warn("Could not renew this server's registration; retrying on the next beat", exception);
    }
  }

  private void heartbeat() {
    final long now = clock.millis();
    jdbi.useTransaction(
        handle -> {
          if (bind(handle.createUpdate(TOUCH), now).execute() == 0) {
            bind(handle.createUpdate(REGISTER), now).execute();
          }
          handle.createUpdate(PRUNE).bind("cutoff", now - RETENTION.toMillis()).execute();
        });
  }

  private Update bind(final Update update, final long now) {
    return update
        .bind("instanceId", instanceId)
        .bind("serverId", serverId)
        .bind("version", version)
        .bind("capabilities", CAPABILITIES)
        .bind("now", now);
  }

  /** The Quartz scheduler that identifies this server in the cluster, and its instance id. */
  public record ClusterIdentity(String schedulerName, String instanceId) {}

  /** One Quartz check-in: every server's app scheduler writes one every few seconds. */
  record CheckIn(String instance, long lastCheckIn, long interval) {
    boolean isLive(final long now) {
      return now - lastCheckIn <= 2 * interval + CHECK_IN_MARGIN.toMillis();
    }
  }

  /** What a server registered about itself, current while it keeps heartbeating. */
  record Registration(String version, List<String> capabilities, long lastHeartbeat) {
    boolean supports(final ServerCapability capability, final long now) {
      return now - lastHeartbeat <= REGISTRATION_TTL.toMillis()
          && capabilities.contains(capability.name());
    }
  }
}
