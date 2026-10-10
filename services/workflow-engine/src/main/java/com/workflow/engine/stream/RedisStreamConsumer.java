package com.workflow.engine.stream;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RedisStreamConsumer {

    private final StringRedisTemplate stringRedisTemplate;

    public void acknowledge(String stream, String group, MapRecord<String, String, String> message) {
        stringRedisTemplate.opsForStream().acknowledge(stream, group, message.getId());
    }
}
