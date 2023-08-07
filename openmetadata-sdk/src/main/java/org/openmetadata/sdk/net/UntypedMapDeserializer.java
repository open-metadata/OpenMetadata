package org.openmetadata.sdk.net;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Deserializer to convert JSON object into an untyped map. While we strive to provide more typed
 * content in this library, there are instances we need to convert our specific choice of JSON
 * representation (using GSON) to a generic {@code Map<String, Object>}.
 */
public class UntypedMapDeserializer {
  /** Strategy for this deserializer. */
  private Strategy strategy;

  /**
   * Strategy to deserialize a JSON element, allowing for custom interactions between the
   * deserialized element and its outer map. For example, for a full JSON: { "foo": 1, "foo_inner":
   * { // outer context map "bar": 1, "zing": 2, // given JSON element }, }
   *
   * <p>Given, a json entry of "zing": 2, the outer map corresponds to value for "foo_inner". A
   * default strategy is to simply deserialize value and puts it at "zing" key in the outer map.
   *
   * <p>Custom strategy allows, for example, renaming the key "zing", wrapping the deserialized
   * value in another map/array, or flattening the value if the deserialized value is a map.
   */
  interface Strategy {
    /**
     * Define how the given JSON element should be deserialized, and how the deserialized content
     * should be added to the given outer map.
     *
     * @param outerMap the untyped map that the deserialized content can be added to.
     * @param jsonEntry original JSON entry with key and json element
     * @param untypedMapDeserializer deserializer for the untyped map to transform the given json
     *     element
     */
    void deserializeAndTransform(
        Map<String, Object> outerMap,
        Map.Entry<String, JsonElement> jsonEntry,
        UntypedMapDeserializer untypedMapDeserializer);
  }

  /**
   * Default deserializer for the untyped map. The result untyped map has same object graph
   * structure as that of the given JSON content.
   */
  public UntypedMapDeserializer() {
    /**
     * Default strategy where each JSON element gets deserialized and added with its original key.
     */
    this.strategy =
        new Strategy() {
          @Override
          public void deserializeAndTransform(
              Map<String, Object> outerMap,
              Map.Entry<String, JsonElement> jsonEntry,
              UntypedMapDeserializer untypedMapDeserializer) {
            outerMap.put(
                jsonEntry.getKey(),
                untypedMapDeserializer.deserializeJsonElement(jsonEntry.getValue()));
          }
        };
  }

  /**
   * Deserializer with a custom strategy.
   *
   * @param strategy definition of how JSON element should be deserialized and set in its outer map.
   */
  UntypedMapDeserializer(Strategy strategy) {
    this.strategy = strategy;
  }

  /**
   * Deserialize JSON into untyped map. {@code JsonArray} is represented as {@code List<Object>}.
   * {@code JsonObject} is represented as {@code Map<String, Object>}. {@code JsonPrimitive} is
   * represented as String, Number, or Boolean.
   *
   * @param jsonObject JSON to convert into untyped map
   * @return untyped map without dependency on JSON representation.
   */
  public Map<String, Object> deserialize(JsonObject jsonObject) {
    Map<String, Object> objMap = new HashMap<>();
    for (Map.Entry<String, JsonElement> entry : jsonObject.entrySet()) {
      this.strategy.deserializeAndTransform(objMap, entry, this);
    }
    return objMap;
  }

  /**
   * Normalizes JSON element into an untyped Object as value to the untyped map.
   *
   * @param element JSON element to convert to java Object
   * @return untyped object, one of {@code Map<String, Object>}, {@code String}, {@code Number},
   *     {@code Boolean}, or {@code List<Array>}.
   */
  Object deserializeJsonElement(JsonElement element) {
    if (element.isJsonNull()) {
      return null;
    } else if (element.isJsonObject()) {
      return deserialize(element.getAsJsonObject());
    } else if (element.isJsonPrimitive()) {
      return deserializeJsonPrimitive(element.getAsJsonPrimitive());
    } else if (element.isJsonArray()) {
      return deserializeJsonArray(element.getAsJsonArray());
    } else {
      System.err.println(
          "Unknown JSON element type for element "
              + element
              + ". "
              + "If you're seeing this message, it's probably a bug in the Stripe Java "
              + "library. Please contact us by email at support@stripe.com.");
      return null;
    }
  }

  private Object deserializeJsonPrimitive(JsonPrimitive element) {
    if (element.isBoolean()) {
      return element.getAsBoolean();
    } else if (element.isNumber()) {
      return element.getAsNumber();
    } else {
      return element.getAsString();
    }
  }

  private List<Object> deserializeJsonArray(JsonArray arr) {
    List<Object> elems = new ArrayList<>(arr.size());
    Iterator<JsonElement> elemIter = arr.iterator();
    while (elemIter.hasNext()) {
      JsonElement elem = elemIter.next();
      elems.add(deserializeJsonElement(elem));
    }
    return elems;
  }
}
