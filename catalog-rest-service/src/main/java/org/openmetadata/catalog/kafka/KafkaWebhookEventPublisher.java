package org.openmetadata.catalog.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Properties;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.openmetadata.catalog.events.WebhookPublisher;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.resources.events.EventResource;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class KafkaWebhookEventPublisher extends WebhookPublisher {

  protected final Webhook webhook;
  private static KafkaProducer<String, String> producer;
  Properties properties = new Properties();

  public KafkaWebhookEventPublisher(Webhook webhook, CollectionDAO dao) {
    super(webhook, dao);
    this.webhook = webhook;
    properties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, webhook.getEndpoint().toString());
    properties.put(ProducerConfig.ACKS_CONFIG, webhook.getKafkaProperties().getAcks());
    properties.put(ProducerConfig.RETRIES_CONFIG, webhook.getKafkaProperties().getRetries());
    properties.put(ProducerConfig.BATCH_SIZE_CONFIG, webhook.getBatchSize());
    properties.put(ProducerConfig.LINGER_MS_CONFIG, webhook.getKafkaProperties().getLingerMS());
    properties.put(ProducerConfig.BUFFER_MEMORY_CONFIG, webhook.getKafkaProperties().getBufferMemory());
    properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, webhook.getKafkaProperties().getKeySerializer());
    properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, webhook.getKafkaProperties().getValueSerializer());
    producer = new KafkaProducer<>(properties);
  }

  @Override
  public void onStart() {
    LOG.info("Kafka Webhook Publisher Started");
  }

  @Override
  public void onShutdown() {
    producer.flush();
    producer.close();
  }

  @Override
  public void publish(EventResource.ChangeEventList events) throws JsonProcessingException {
    if (webhook.getKafkaProperties().getTopics() != null) {
      for (String topic : webhook.getKafkaProperties().getTopics()) {
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
