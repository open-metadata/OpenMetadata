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

package org.openmetadata.service.security.credentials;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.util.Duration;
import org.openmetadata.service.jdbi3.EntityDAO;

/**
 * The {@code credentialVerification:} block of openmetadata.yaml. Every field is optional and
 * defaults when absent, so an existing yaml without the block works. Validated once here, at the
 * boundary; the verifier trusts it.
 *
 * <p>Duration fields take Dropwizard strings such as {@code 5s}, {@code 500ms} and {@code 15m}.
 */
public record CredentialVerificationConfig(
    @JsonProperty("maxStaleness") Duration maxStaleness,
    @JsonProperty("sweepInterval") Duration sweepInterval,
    @JsonProperty("missRefreshMinAge") Duration missRefreshMinAge,
    @JsonProperty("loadTimeout") Duration loadTimeout,
    @JsonProperty("maxConcurrentRequestReads") Integer maxConcurrentRequestReads,
    @JsonProperty("idleExpiry") Duration idleExpiry,
    @JsonProperty("maxSubjects") Integer maxSubjects,
    @JsonProperty("batchSize") Integer batchSize,
    @JsonProperty("deepVerifyInterval") Duration deepVerifyInterval) {

  private static final Duration DEFAULT_MAX_STALENESS = Duration.seconds(5);
  private static final Duration DEFAULT_SWEEP_INTERVAL = Duration.seconds(2);
  private static final Duration DEFAULT_MISS_REFRESH_MIN_AGE = Duration.milliseconds(500);
  private static final Duration DEFAULT_LOAD_TIMEOUT = Duration.seconds(2);
  private static final Duration DEFAULT_IDLE_EXPIRY = Duration.minutes(15);
  private static final Duration DEFAULT_DEEP_VERIFY_INTERVAL = Duration.minutes(10);
  private static final int DEFAULT_MAX_CONCURRENT_REQUEST_READS = 16;
  private static final int DEFAULT_MAX_SUBJECTS = 4000;
  private static final int DEFAULT_BATCH_SIZE = 500;

  /** Nulls take defaults; then rejects, naming the field, any value the verifier cannot honor. */
  public CredentialVerificationConfig {
    maxStaleness = orDefault(maxStaleness, DEFAULT_MAX_STALENESS);
    sweepInterval = orDefault(sweepInterval, DEFAULT_SWEEP_INTERVAL);
    missRefreshMinAge = orDefault(missRefreshMinAge, DEFAULT_MISS_REFRESH_MIN_AGE);
    loadTimeout = orDefault(loadTimeout, DEFAULT_LOAD_TIMEOUT);
    idleExpiry = orDefault(idleExpiry, DEFAULT_IDLE_EXPIRY);
    deepVerifyInterval = orDefault(deepVerifyInterval, DEFAULT_DEEP_VERIFY_INTERVAL);
    maxConcurrentRequestReads =
        orDefault(maxConcurrentRequestReads, DEFAULT_MAX_CONCURRENT_REQUEST_READS);
    maxSubjects = orDefault(maxSubjects, DEFAULT_MAX_SUBJECTS);
    batchSize = orDefault(batchSize, DEFAULT_BATCH_SIZE);
    validateDurations(
        maxStaleness,
        sweepInterval,
        missRefreshMinAge,
        loadTimeout,
        idleExpiry,
        deepVerifyInterval);
    validateRelations(maxStaleness, sweepInterval, missRefreshMinAge, loadTimeout);
    validateCounts(maxConcurrentRequestReads, maxSubjects, batchSize);
  }

  /** Config with every field at its default. */
  public static CredentialVerificationConfig defaults() {
    return new CredentialVerificationConfig(null, null, null, null, null, null, null, null, null);
  }

  public long maxStalenessNanos() {
    return maxStaleness.toNanoseconds();
  }

  public long sweepIntervalNanos() {
    return sweepInterval.toNanoseconds();
  }

  public long missRefreshMinAgeNanos() {
    return missRefreshMinAge.toNanoseconds();
  }

  public long loadTimeoutNanos() {
    return loadTimeout.toNanoseconds();
  }

  public long idleExpiryNanos() {
    return idleExpiry.toNanoseconds();
  }

  public long deepVerifyIntervalNanos() {
    return deepVerifyInterval.toNanoseconds();
  }

  private static <T> T orDefault(T value, T fallback) {
    return value == null ? fallback : value;
  }

  private static void validateDurations(
      Duration maxStaleness,
      Duration sweepInterval,
      Duration missRefreshMinAge,
      Duration loadTimeout,
      Duration idleExpiry,
      Duration deepVerifyInterval) {
    requirePositive("maxStaleness", maxStaleness);
    requirePositive("sweepInterval", sweepInterval);
    requirePositive("missRefreshMinAge", missRefreshMinAge);
    requirePositive("loadTimeout", loadTimeout);
    requirePositive("idleExpiry", idleExpiry);
    requirePositive("deepVerifyInterval", deepVerifyInterval);
  }

  private static void validateRelations(
      Duration maxStaleness,
      Duration sweepInterval,
      Duration missRefreshMinAge,
      Duration loadTimeout) {
    long bound = maxStaleness.toNanoseconds();
    require(
        sweepInterval.toNanoseconds() * 2 <= bound,
        "sweepInterval must be at most half of maxStaleness, so one missed sweep is absorbed");
    require(
        missRefreshMinAge.toNanoseconds() < bound,
        "missRefreshMinAge must be less than maxStaleness");
    require(loadTimeout.toNanoseconds() < bound, "loadTimeout must be less than maxStaleness");
  }

  private static void validateCounts(
      int maxConcurrentRequestReads, int maxSubjects, int batchSize) {
    require(maxConcurrentRequestReads >= 1, "maxConcurrentRequestReads must be at least 1");
    require(
        batchSize >= 1 && batchSize <= EntityDAO.MAX_IN_LIST_CHUNK_SIZE,
        "batchSize must be between 1 and " + EntityDAO.MAX_IN_LIST_CHUNK_SIZE);
    require(maxSubjects >= batchSize, "maxSubjects must be at least batchSize");
  }

  private static void requirePositive(String field, Duration value) {
    require(value.toNanoseconds() > 0, field + " must be positive");
  }

  private static void require(boolean condition, String message) {
    if (!condition) {
      throw new IllegalArgumentException("credentialVerification: " + message);
    }
  }
}
