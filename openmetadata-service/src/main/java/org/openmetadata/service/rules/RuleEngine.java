package org.openmetadata.service.rules;

import io.github.jamsesso.jsonlogic.JsonLogic;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class RuleEngine {

  @Getter private static final RuleEngine instance = new RuleEngine();
  private final JsonLogic jsonLogic;

  private RuleEngine() {
    this.jsonLogic = new JsonLogic();
    LogicOps.addCustomOps(jsonLogic);
  }

  public Object apply(String rule, Map<String, Object> context) {
    try {
      return jsonLogic.apply(rule, context);
    } catch (Exception e) {
      // Return false, falls back to using workflow
      return false;
    }
  }
}
