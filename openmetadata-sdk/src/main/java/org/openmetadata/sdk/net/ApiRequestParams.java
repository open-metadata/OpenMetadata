package org.openmetadata.sdk.net;

import java.util.Map;


public abstract class ApiRequestParams {

  private static final ApiRequestParamsConverter PARAMS_CONVERTER = new ApiRequestParamsConverter();

  public interface EnumParam {
    String getValue();
  }

  public Map<String, Object> toMap() {
    return PARAMS_CONVERTER.convert(this);
  }
}
