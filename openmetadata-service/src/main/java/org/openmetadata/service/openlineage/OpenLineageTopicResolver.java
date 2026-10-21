/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.NOT_FOUND;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.SERVICE_NOT_FOUND;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.UNPARSABLE_NAME;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.openlineage.OpenLineageResolution.resolved;
import static org.openmetadata.service.openlineage.OpenLineageResolution.unresolved;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Resolves {@code kafka://host:port} datasets to topics, finding the messaging service whose
 * bootstrapServers lists that broker. Services on the exact host:port are the only candidates. When
 * no service lists the exact address, another listener port of the same host is accepted only if a
 * single service sits on that host (e.g. a TLS 9093 event against the one 9092 service). Falling back
 * past an exact-address service that has not ingested the topic yet, or picking among several
 * clusters behind one gateway host, would attach the edge to another cluster's same-named topic. The
 * topic must exist in exactly one candidate service, so services sharing a broker never resolve by
 * guesswork. Topics are never created.
 */
@Slf4j
final class OpenLineageTopicResolver {

  private static final String KAFKA_SCHEME = "kafka://";
  private static final String SCHEME_SEPARATOR = "://";
  private static final String BOOTSTRAP_SERVERS = "bootstrapServers";
  private static final int NO_PORT = -1;
  private static final int MAX_PORT_DIGITS = 5;

  record BrokerAddress(String host, int port) {
    boolean hasSameHost(BrokerAddress other) {
      return host.equals(other.host);
    }
  }

  record ServiceBroker(String serviceFqn, BrokerAddress address) {}

  /** Read once per resolver, which lives for a single request. */
  private List<ServiceBroker> serviceBrokers;

  static boolean isKafkaNamespace(String namespace) {
    return !nullOrEmpty(namespace) && namespace.toLowerCase(Locale.ROOT).startsWith(KAFKA_SCHEME);
  }

  OpenLineageResolution resolve(String namespace, String topicName) {
    Optional<BrokerAddress> broker = parseBroker(namespace.substring(KAFKA_SCHEME.length()));
    return broker.isEmpty() || nullOrEmpty(topicName)
        ? unresolved(UNPARSABLE_NAME, "A kafka:// dataset needs a broker host and a topic name")
        : resolveOnBroker(broker.get(), topicName);
  }

  private OpenLineageResolution resolveOnBroker(BrokerAddress broker, String topicName) {
    List<String> exactServices = servicesMatching(broker::equals);
    List<String> hostServices = servicesMatching(broker::hasSameHost);
    return exactServices.isEmpty() && hostServices.size() > 1
        ? unresolvedOtherPort(broker, hostServices)
        : resolveInServices(
            broker, topicName, exactServices.isEmpty() ? hostServices : exactServices);
  }

  private static OpenLineageResolution resolveInServices(
      BrokerAddress broker, String topicName, List<String> candidateServices) {
    List<EntityReference> topics = findTopics(candidateServices, topicName);
    return topics.size() == 1
        ? resolved(topics.getFirst())
        : unresolvedTopic(broker, topicName, candidateServices, topics);
  }

  private static OpenLineageResolution unresolvedOtherPort(
      BrokerAddress broker, List<String> hostServices) {
    return unresolved(
        SERVICE_NOT_FOUND,
        String.format(
            "No messaging service lists this exact broker address, and services %s list other "
                + "ports of host '%s'; dropping the edge rather than guessing which cluster it is",
            hostServices, broker.host()));
  }

  private static OpenLineageResolution unresolvedTopic(
      BrokerAddress broker,
      String topicName,
      List<String> candidateServices,
      List<EntityReference> topics) {
    OpenLineageResolution result;
    if (candidateServices.isEmpty()) {
      result =
          unresolved(
              SERVICE_NOT_FOUND,
              String.format(
                  "No messaging service lists broker host '%s' in its bootstrapServers",
                  broker.host()));
    } else if (topics.isEmpty()) {
      result =
          unresolved(
              NOT_FOUND,
              String.format(
                  "No topic '%s' exists in messaging services %s, and topics are never created",
                  topicName, candidateServices));
    } else {
      result =
          unresolved(
              NOT_FOUND,
              String.format(
                  "Topic '%s' exists in %d messaging services sharing broker '%s' (%s), "
                      + "dropping the edge rather than guessing",
                  topicName,
                  topics.size(),
                  broker.host(),
                  topics.stream().map(EntityReference::getFullyQualifiedName).toList()));
    }
    return result;
  }

  private List<String> servicesMatching(Predicate<BrokerAddress> matches) {
    return serviceBrokers().stream()
        .filter(serviceBroker -> matches.test(serviceBroker.address()))
        .map(ServiceBroker::serviceFqn)
        .distinct()
        .toList();
  }

  private static List<EntityReference> findTopics(List<String> serviceFqns, String topicName) {
    return serviceFqns.stream()
        .map(serviceFqn -> findTopic(FullyQualifiedName.add(serviceFqn, topicName)))
        .filter(Objects::nonNull)
        .toList();
  }

  private static EntityReference findTopic(String topicFqn) {
    EntityReference topic = null;
    try {
      topic = Entity.getEntityReferenceByName(Entity.TOPIC, topicFqn, NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.debug("Topic not found: {}", topicFqn);
    }
    return topic;
  }

  private List<ServiceBroker> serviceBrokers() {
    if (serviceBrokers == null) {
      serviceBrokers = listMessagingServices().stream().flatMap(this::brokersOf).toList();
    }
    return serviceBrokers;
  }

  private Stream<ServiceBroker> brokersOf(MessagingService service) {
    return Arrays.stream(bootstrapServers(service).split(","))
        .map(OpenLineageTopicResolver::parseBroker)
        .flatMap(Optional::stream)
        .map(address -> new ServiceBroker(service.getFullyQualifiedName(), address));
  }

  /** Kafka and Redpanda both carry bootstrapServers; any other messaging service has none. */
  private static String bootstrapServers(MessagingService service) {
    Object config = service.getConnection() == null ? null : service.getConnection().getConfig();
    return config == null ? "" : JsonUtils.valueToTree(config).path(BOOTSTRAP_SERVERS).asText("");
  }

  private static List<MessagingService> listMessagingServices() {
    @SuppressWarnings("unchecked")
    EntityRepository<MessagingService> repository =
        (EntityRepository<MessagingService>) Entity.getEntityRepository(Entity.MESSAGING_SERVICE);
    return repository.listAll(repository.getFields(""), new ListFilter(NON_DELETED));
  }

  /**
   * Parses {@code host[:port]}, tolerating a listener scheme ({@code SASL_SSL://host:9093}) and a
   * trailing path. Parsed by hand because {@link java.net.URI} rejects the underscores common in
   * container hostnames such as {@code kafka_broker}.
   */
  static Optional<BrokerAddress> parseBroker(String entry) {
    String authority = stripPath(stripScheme(entry.strip()));
    int colon = authority.lastIndexOf(':');
    String portText = colon < 0 ? "" : authority.substring(colon + 1);
    boolean hasPort =
        !portText.isEmpty()
            && portText.length() <= MAX_PORT_DIGITS
            && portText.chars().allMatch(Character::isDigit);
    String host = hasPort ? authority.substring(0, colon) : authority;
    return host.isEmpty()
        ? Optional.empty()
        : Optional.of(
            new BrokerAddress(
                host.toLowerCase(Locale.ROOT), hasPort ? Integer.parseInt(portText) : NO_PORT));
  }

  private static String stripScheme(String entry) {
    int separator = entry.indexOf(SCHEME_SEPARATOR);
    return separator < 0 ? entry : entry.substring(separator + SCHEME_SEPARATOR.length());
  }

  private static String stripPath(String entry) {
    int slash = entry.indexOf('/');
    return slash < 0 ? entry : entry.substring(0, slash);
  }
}
