package com.workflow.engine.config;

import com.workflow.engine.stream.StreamNames;
import com.workflow.engine.stream.WorkflowEventListener;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;
import org.springframework.data.redis.stream.StreamMessageListenerContainer.StreamMessageListenerContainerOptions;
import org.springframework.data.redis.stream.Subscription;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class RedisStreamConfig {

    private final StringRedisTemplate stringRedisTemplate;
    private final AppProperties appProperties;
    private final WorkflowEventListener workflowEventListener;

    @PostConstruct
    void ensureConsumerGroups() {
        createGroupIfMissing(appProperties.redis().stream().transformEvents(), StreamNames.WORKFLOW_ENGINE_GROUP);
        createGroupIfMissing(appProperties.redis().stream().workflowEvents(), StreamNames.WORKFLOW_ENGINE_GROUP);
    }

    private void createGroupIfMissing(String stream, String group) {
        try {
            stringRedisTemplate.opsForStream().createGroup(stream, ReadOffset.latest(), group);
            log.info("Created Redis consumer group {} on stream {}", group, stream);
        } catch (Exception ex) {
            log.debug("Consumer group {} on {} may already exist: {}", group, stream, ex.getMessage());
        }
    }

    @Bean(initMethod = "start", destroyMethod = "stop")
    public StreamMessageListenerContainer<String, MapRecord<String, String, String>> streamListenerContainer(
            RedisConnectionFactory connectionFactory) {
        StreamMessageListenerContainerOptions<String, MapRecord<String, String, String>> options =
                StreamMessageListenerContainerOptions.builder()
                        .pollTimeout(Duration.ofSeconds(2))
                        .build();

        StreamMessageListenerContainer<String, MapRecord<String, String, String>> container =
                StreamMessageListenerContainer.create(connectionFactory, options);

        String stream = appProperties.redis().stream().transformEvents();
        Consumer consumer = Consumer.from(StreamNames.WORKFLOW_ENGINE_GROUP, appProperties.redis().consumerName());
        container.receive(consumer, StreamOffset.create(stream, ReadOffset.lastConsumed()), workflowEventListener);

        return container;
    }
}
