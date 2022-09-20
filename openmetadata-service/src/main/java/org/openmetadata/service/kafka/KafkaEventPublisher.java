package org.openmetadata.service.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.lmax.disruptor.BatchEventProcessor;
import java.util.ArrayList;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.Callback;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.openmetadata.schema.api.kafka.KafkaEventConfiguration;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.AbstractEventPublisher;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class KafkaEventPublisher extends AbstractEventPublisher {
  private final CountDownLatch shutdownLatch = new CountDownLatch(1);
  protected final KafkaEventConfiguration kafkaEventConfiguration;
  private static KafkaProducer<String, String> producer;
  ProducerRecord<String, String> record;
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
      record = new ProducerRecord<>(topic, eventJson);
      producer.send(record, new KafkaCallback());
    }
  }

  public static class KafkaCallback implements Callback {
    @Override
    public void onCompletion(RecordMetadata recordMetadata, Exception e) {
      if (e == null) LOG.info("Message successfully published on topic: {}", recordMetadata.topic());
      else LOG.error("Couldn't publish message on topic: {} due to {}", recordMetadata.topic(), e.getMessage());
    }
  }
}
