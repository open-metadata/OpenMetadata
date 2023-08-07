package org.openmetadata.sdk.net;

import com.google.gson.FieldNamingPolicy;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.TypeAdapter;
import com.google.gson.TypeAdapterFactory;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;
import java.io.IOException;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.Map;

class ApiRequestParamsConverter {
  private static final Gson GSON =
      new GsonBuilder()
          .registerTypeAdapterFactory(new HasEmptyEnumTypeAdapterFactory())
          .registerTypeAdapterFactory(new NullValuesInMapsTypeAdapterFactory())
          .create();

  private static final UntypedMapDeserializer FLATTENING_EXTRA_PARAMS_DESERIALIZER =
      new UntypedMapDeserializer(new ExtraParamsFlatteningStrategy());

  /** Strategy to flatten extra params in the API request parameters. */
  private static class ExtraParamsFlatteningStrategy implements UntypedMapDeserializer.Strategy {
    @Override
    public void deserializeAndTransform(
        Map<String, Object> outerMap,
        Map.Entry<String, JsonElement> jsonEntry,
        UntypedMapDeserializer untypedMapDeserializer) {
      String key = jsonEntry.getKey();
      JsonElement jsonValue = jsonEntry.getValue();
      if (ApiRequestParams.EXTRA_PARAMS_KEY.equals(key)) {
        if (!jsonValue.isJsonObject()) {
          throw new IllegalStateException(
              String.format(
                  "Unexpected schema for extra params. JSON object is expected at key `%s`, but found"
                      + " `%s`. This is likely a problem with this current library version `%s`. "
                      + "Please contact support@stripe.com for assistance.",
                  ApiRequestParams.EXTRA_PARAMS_KEY, jsonValue, Stripe.VERSION));
        }
        // JSON value now corresponds to the extra params map, and is also deserialized as a map.
        // Instead of putting this result map under the original key, flatten the map
        // by adding all its key/value pairs to the outer map instead.
        Map<String, Object> extraParamsMap =
            untypedMapDeserializer.deserialize(jsonValue.getAsJsonObject());
        for (Map.Entry<String, Object> entry : extraParamsMap.entrySet()) {
          validateDuplicateKey(outerMap, entry.getKey(), entry.getValue());
          outerMap.put(entry.getKey(), entry.getValue());
        }
      } else {
        Object value = untypedMapDeserializer.deserializeJsonElement(jsonValue);
        validateDuplicateKey(outerMap, key, value);

        // Normal deserialization where output map has the same structure as the given JSON content.
        // The deserialized content is an untyped `Object` and added to the outer map at the
        // original key.
        outerMap.put(key, value);
      }
    }
  }

  private static void validateDuplicateKey(
      Map<String, Object> outerMap, String paramKey, Object paramValue) {
    if (outerMap.containsKey(paramKey)) {
      throw new IllegalArgumentException(
          String.format(
              "Found multiple param values for the same param key. This can happen because you passed "
                  + "additional parameters via `putExtraParam` that conflict with the existing params. "
                  + "Found param key `%s` with values `%s` and `%s`. "
                  + "If you wish to pass additional params for nested parameters, you "
                  + "should add extra params at the nested params themselves, not from the "
                  + "top-level param.",
              paramKey, outerMap.get(paramKey), paramValue));
    }
  }

  private static class NullValuesInMapsTypeAdapterFactory implements TypeAdapterFactory {
    TypeAdapter<?> getValueAdapter(Gson gson, TypeToken<?> type) {
      Type valueType;
      if (type.getType() instanceof ParameterizedType) {
        ParameterizedType mapParameterizedType = (ParameterizedType) type.getType();
        valueType = mapParameterizedType.getActualTypeArguments()[1];
      } else {
        valueType = Object.class;
      }

      return gson.getAdapter(TypeToken.get(valueType));
    }

    @Override
    public <T> TypeAdapter<T> create(Gson gson, TypeToken<T> type) {
      if (!Map.class.isAssignableFrom(type.getRawType())) {
        return null;
      }

      final TypeAdapter<?> valueAdapter = getValueAdapter(gson, type);
      final TypeAdapter<T> delegate = gson.getDelegateAdapter(this, type);
      @SuppressWarnings({"unchecked", "rawtypes"})
      final TypeAdapter<T> typeAdapter = new MapAdapter(valueAdapter, delegate);

      return typeAdapter.nullSafe();
    }
  }

  private static class MapAdapter<V> extends TypeAdapter<Map<String, V>> {
    private TypeAdapter<V> valueTypeAdapter;
    private TypeAdapter<Map<String, V>> mapTypeAdapter;

    public MapAdapter(TypeAdapter<V> valueTypeAdapter, TypeAdapter<Map<String, V>> mapTypeAdapter) {
      this.valueTypeAdapter = valueTypeAdapter;
      this.mapTypeAdapter = mapTypeAdapter;
    }

    @Override
    public void write(JsonWriter out, Map<String, V> value) throws IOException {
      if (value == null) {
        out.nullValue();
        return;
      }

      out.beginObject();
      for (Map.Entry<String, V> entry : value.entrySet()) {
        out.name(entry.getKey());
        V entryValue = entry.getValue();
        if (entryValue == null) {
          boolean oldSerializeNullsValue = out.getSerializeNulls();
          try {
            out.setSerializeNulls(true);
            out.nullValue();
          } finally {
            out.setSerializeNulls(oldSerializeNullsValue);
          }
        } else {
          valueTypeAdapter.write(out, entryValue);
        }
      }
      out.endObject();
    }

    @Override
    public Map<String, V> read(JsonReader in) throws IOException {
      return mapTypeAdapter.read(in);
    }
  }

  /**
   * Type adapter to convert an empty enum to null value to comply with the lower-lever encoding
   * logic for the API request parameters.
   */
  private static class HasEmptyEnumTypeAdapterFactory implements TypeAdapterFactory {
    @SuppressWarnings("unchecked")
    @Override
    public <T> TypeAdapter<T> create(Gson gson, TypeToken<T> type) {
      if (!ApiRequestParams.EnumParam.class.isAssignableFrom(type.getRawType())) {
        return null;
      }

      TypeAdapter<ApiRequestParams.EnumParam> paramEnum =
          new TypeAdapter<ApiRequestParams.EnumParam>() {
            @Override
            public void write(JsonWriter out, ApiRequestParams.EnumParam value) throws IOException {
              if (value.getValue().equals("")) {
                // need to restore serialize null setting
                // not to affect other fields
                boolean previousSetting = out.getSerializeNulls();
                out.setSerializeNulls(true);
                out.nullValue();
                out.setSerializeNulls(previousSetting);
              } else {
                out.value(value.getValue());
              }
            }

            @Override
            public ApiRequestParams.EnumParam read(JsonReader in) {
              throw new UnsupportedOperationException(
                  "No deserialization is expected from this private type adapter for enum param.");
            }
          };
      return (TypeAdapter<T>) paramEnum.nullSafe();
    }
  }

  Map<String, Object> convert(ApiRequestParams apiRequestParams) {
    JsonObject jsonParams = GSON.toJsonTree(apiRequestParams).getAsJsonObject();
    return FLATTENING_EXTRA_PARAMS_DESERIALIZER.deserialize(jsonParams);
  }
}
