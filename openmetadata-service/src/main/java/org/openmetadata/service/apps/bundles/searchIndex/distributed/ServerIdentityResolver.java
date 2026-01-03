/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

/**
 * Resolves the unique identity of this server instance for distributed coordination.
 *
 * <p>Uses Quartz scheduler's instance ID when available (since Quartz clustering is enabled), with
 * fallback mechanisms for cases where Quartz is not initialized.
 */
@Slf4j
public class ServerIdentityResolver {

  private static final String FALLBACK_PREFIX = "om-server-";

  @Getter private final String serverId;

  private static ServerIdentityResolver instance;

  private ServerIdentityResolver() {
    this.serverId = resolveServerId();
    LOG.info("Server identity resolved: {}", this.serverId);
  }

  /**
   * Get the singleton instance of ServerIdentityResolver.
   *
   * @return The singleton instance
   */
  public static synchronized ServerIdentityResolver getInstance() {
    if (instance == null) {
      instance = new ServerIdentityResolver();
    }
    return instance;
  }

  /**
   * Resolve the server ID using available mechanisms.
   *
   * <p>Priority order: 1. Quartz scheduler instance ID (most reliable in clustered setup) 2.
   * Hostname + PID combination 3. Generated UUID (last resort)
   *
   * @return The resolved server ID
   */
  private String resolveServerId() {
    // Try Quartz scheduler instance ID first
    String quartzInstanceId = getQuartzInstanceId();
    if (quartzInstanceId != null && !quartzInstanceId.isEmpty()) {
      LOG.debug("Using Quartz scheduler instance ID: {}", quartzInstanceId);
      return quartzInstanceId;
    }

    // Fallback to hostname + PID
    String hostBasedId = getHostBasedId();
    if (hostBasedId != null) {
      LOG.debug("Using host-based ID: {}", hostBasedId);
      return hostBasedId;
    }

    // Last resort: generate a UUID
    String fallbackId = FALLBACK_PREFIX + UUID.randomUUID();
    LOG.warn("Using fallback UUID as server ID: {}", fallbackId);
    return fallbackId;
  }

  /**
   * Get the Quartz scheduler instance ID if available.
   *
   * @return The scheduler instance ID or null if not available
   */
  private String getQuartzInstanceId() {
    try {
      AppScheduler appScheduler = AppScheduler.getInstance();
      if (appScheduler != null) {
        Scheduler scheduler = appScheduler.getScheduler();
        if (scheduler != null) {
          return scheduler.getSchedulerInstanceId();
        }
      }
    } catch (SchedulerException e) {
      LOG.debug("Failed to get Quartz scheduler instance ID: {}", e.getMessage());
    } catch (Exception e) {
      LOG.debug("AppScheduler not initialized yet: {}", e.getMessage());
    }
    return null;
  }

  /**
   * Generate a host-based ID using hostname and process ID.
   *
   * @return Host-based ID or null if unable to determine
   */
  private String getHostBasedId() {
    try {
      String hostname = InetAddress.getLocalHost().getHostName();
      String pid = getProcessId();
      return FALLBACK_PREFIX + hostname + "-" + pid;
    } catch (UnknownHostException e) {
      LOG.debug("Failed to get hostname: {}", e.getMessage());
      return null;
    }
  }

  /**
   * Get the process ID of this JVM instance.
   *
   * @return The process ID as a string
   */
  private String getProcessId() {
    // Using ManagementFactory to get process ID
    String processName = ManagementFactory.getRuntimeMXBean().getName();
    // Format is typically "pid@hostname"
    if (processName.contains("@")) {
      return processName.split("@")[0];
    }
    // Java 9+ has ProcessHandle
    return String.valueOf(ProcessHandle.current().pid());
  }

  /**
   * Check if two server IDs refer to the same server.
   *
   * @param id1 First server ID
   * @param id2 Second server ID
   * @return true if they refer to the same server
   */
  public static boolean isSameServer(String id1, String id2) {
    if (id1 == null || id2 == null) {
      return false;
    }
    return id1.equals(id2);
  }

  /**
   * Check if the given server ID is this server.
   *
   * @param serverId The server ID to check
   * @return true if the ID matches this server
   */
  public boolean isThisServer(String serverId) {
    return isSameServer(this.serverId, serverId);
  }

  /**
   * Reset the singleton instance. Primarily for testing purposes.
   */
  public static synchronized void reset() {
    instance = null;
  }
}
