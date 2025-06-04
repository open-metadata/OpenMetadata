package org.openmetadata.service.rules;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.github.jamsesso.jsonlogic.JsonLogic;

public class LogicOps {
  // Add custom operations to JsonLogic
  public static void addCustomOps(JsonLogic jsonLogic) {
    jsonLogic.addOperation(
        "length",
        (args) -> {
          if (nullOrEmpty(args)) {
            return 0;
          }
          return args.length;
        });
  }
}
