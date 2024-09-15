package org.openmetadata.service.apps;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

public class AppUtil {
  public enum RunType {
    ON_DEMAND_RUN("OnDemandRun"),
    SCHEDULED_RUN("ScheduledRun");
    private final String value;
    private static final Map<String, RunType> CONSTANTS = new HashMap<>();

    static {
      for (RunType c : values()) {
        CONSTANTS.put(c.value, c);
      }
    }

    RunType(String value) {
      this.value = value;
    }

    @Override
    public String toString() {
      return this.value;
    }

    @JsonValue
    public String value() {
      return this.value;
    }

    @JsonCreator
    public static RunType fromValue(String value) {
      RunType constant = CONSTANTS.get(value);
      if (constant == null) {
        throw new IllegalArgumentException(value);
      } else {
        return constant;
      }
    }
  }

  public enum AppRunStatus {
    STARTED("started"),
    RUNNING("running"),
    FAILED("failed"),
    ABORTED("aborted");
    private final String value;
    private static final Map<String, AppRunStatus> CONSTANTS = new HashMap<>();

    static {
      for (AppRunStatus c : values()) {
        CONSTANTS.put(c.value, c);
      }
    }

    AppRunStatus(String value) {
      this.value = value;
    }

    @Override
    public String toString() {
      return this.value;
    }

    @JsonValue
    public String value() {
      return this.value;
    }

    @JsonCreator
    public static AppRunStatus fromValue(String value) {
      AppRunStatus constant = CONSTANTS.get(value);
      if (constant == null) {
        throw new IllegalArgumentException(value);
      } else {
        return constant;
      }
    }
  }

  @Getter
  @Setter
  public static class AppRunHistory {
    private String appId;
    private String appName;
    private String runId;
    private Long timestamp;
    private AppRunStatus status;
    private String runType;
  }
}
