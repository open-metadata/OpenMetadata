package org.openmetadata.catalog.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.lmax.disruptor.BatchEventProcessor;
import java.util.ArrayList;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.events.EventPubSub;
import org.openmetadata.catalog.resources.events.EventResource;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class KafkaEventPublisher extends AbstractEventPublisher {
  private final CountDownLatch shutdownLatch = new CountDownLatch(1);
  protected final KafkaEventConfiguration kafkaEventConfiguration;
  private static KafkaProducer<String, String> producer;
  Properties properties = new Properties();
  private BatchEventProcessor<EventPubSub.ChangeEventHolder> processor;

  public KafkaEventPublisher(KafkaEventConfiguration kafkaConfig) {
    super(kafkaConfig.getBatchSize(), new ArrayList<>());
    this.kafkaEventConfiguration = kafkaConfig;
    if (kafkaConfig.getKafkaConfig().size() != 0) {
      properties.putAll(kafkaConfig.getKafkaConfig());
    }
    properties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, kafkaConfig.getBootstrapServers());
    properties.put(ProducerConfig.BATCH_SIZE_CONFIG, kafkaConfig.getBatchSize());
    properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, kafkaConfig.getKeySerializer());
    properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, kafkaConfig.getValueSerializer());
    producer = new KafkaProducer<>(properties);
  }

  public void awaitShutdown() throws InterruptedException {
    LOG.info("Awaiting shutdown kafka-lifecycle {}", kafkaEventConfiguration.getTopics());
    shutdownLatch.await(5, TimeUnit.SECONDS);
  }

  public void setProcessor(BatchEventProcessor<EventPubSub.ChangeEventHolder> processor) {
    this.processor = processor;
  }

  public BatchEventProcessor<EventPubSub.ChangeEventHolder> getProcessor() {
    return processor;
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
    String topic = kafkaEventConfiguration.getTopics();
    for (ChangeEvent event : events.getData()) {
      String eventJson = JsonUtils.pojoToJson(event);
      producer.send(new ProducerRecord<>(topic, eventJson));
    }
  }
}
