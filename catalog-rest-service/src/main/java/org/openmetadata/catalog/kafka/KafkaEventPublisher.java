package org.openmetadata.catalog.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.ArrayList;
import java.util.Properties;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.CommonClientConfigs;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.config.SslConfigs;
import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.resources.events.EventResource;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class KafkaEventPublisher extends AbstractEventPublisher {

  protected final KafkaEventConfiguration kafkaEventConfiguration;
  private static KafkaProducer<String, String> producer;
  Properties properties = new Properties();

  public KafkaEventPublisher(KafkaEventConfiguration kafkaConfig) {
    super(kafkaConfig.getBatchSize(), new ArrayList<>());
    this.kafkaEventConfiguration = kafkaConfig;
    if (kafkaConfig.getSecurityProtocol().equals(KafkaEventConfiguration.SecurityProtocol.SSL)) {
      // configuration for SSL Encryption
      if (kafkaConfig.getSSLProtocol() != null
          && kafkaConfig.getSSLTrustStoreLocation() != null
          && kafkaConfig.getSSLTrustStorePassword() != null
          && kafkaConfig.getSSLKeystoreLocation() != null
          && kafkaConfig.getSSLKeystorePassword() != null
          && kafkaConfig.getSSLKeyPassword() != null) {
        properties.put(CommonClientConfigs.SECURITY_PROTOCOL_CONFIG, kafkaConfig.getSecurityProtocol().toString());
        properties.put(SslConfigs.SSL_PROTOCOL_CONFIG, kafkaConfig.getSSLProtocol());
        properties.put(SslConfigs.SSL_TRUSTSTORE_LOCATION_CONFIG, kafkaConfig.getSSLTrustStoreLocation());
        properties.put(SslConfigs.SSL_TRUSTSTORE_PASSWORD_CONFIG, kafkaConfig.getSSLTrustStorePassword());
        // configuration for SSL Authentication
        properties.put(SslConfigs.SSL_KEYSTORE_LOCATION_CONFIG, kafkaConfig.getSSLKeystoreLocation());
        properties.put(SslConfigs.SSL_KEYSTORE_PASSWORD_CONFIG, kafkaConfig.getSSLKeystorePassword());
        properties.put(SslConfigs.SSL_KEY_PASSWORD_CONFIG, kafkaConfig.getSSLKeyPassword());
      } else {
        LOG.info("The SSL could not be configured as the required properties are not defined!");
      }
    }
    properties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, kafkaConfig.getBootstrapServers());
    properties.put(ProducerConfig.ACKS_CONFIG, kafkaConfig.getAcks());
    properties.put(ProducerConfig.RETRIES_CONFIG, kafkaConfig.getRetries());
    properties.put(ProducerConfig.BATCH_SIZE_CONFIG, kafkaConfig.getBatchSize());
    properties.put(ProducerConfig.LINGER_MS_CONFIG, kafkaConfig.getLingerMS());
    properties.put(ProducerConfig.BUFFER_MEMORY_CONFIG, kafkaConfig.getBufferMemory());
    properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, kafkaConfig.getKeySerializer());
    properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, kafkaConfig.getValueSerializer());
    producer = new KafkaProducer<>(properties);
  }

  @Override
  public void onStart() {
    LOG.info("Kafka Publisher Started");
  }

  @Override
  public void onShutdown() {
    producer.flush();
    producer.close();
  }

  @Override
  public void publish(EventResource.ChangeEventList events) throws JsonProcessingException {
    if (kafkaEventConfiguration.getTopics() != null) {
      for (String topic : kafkaEventConfiguration.getTopics()) {
        for (ChangeEvent event : events.getData()) {
          String eventJson = JsonUtils.pojoToJson(event);
          producer.send(new ProducerRecord<>(topic, eventJson));
        }
      }
    } else {
      LOG.info("Topics are null");
    }
  }
}
