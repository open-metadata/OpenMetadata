package org.openmetadata.service.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;

public class JsonUtils {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private JsonUtils() {}

    public static <T> T readValue(String content, Class<T> valueType) throws IOException {
        return OBJECT_MAPPER.readValue(content, valueType);
    }

    public static String pojoToJson(Object obj) throws JsonProcessingException {
        return OBJECT_MAPPER.writeValueAsString(obj);
    }

    public static JsonNode valueToTree(Object obj) {
        return OBJECT_MAPPER.valueToTree(obj);
    }

    public static ObjectNode createObjectNode() {
        return OBJECT_MAPPER.createObjectNode();
    }

    public static ObjectMapper getObjectMapper() {
        return OBJECT_MAPPER;
    }
} 