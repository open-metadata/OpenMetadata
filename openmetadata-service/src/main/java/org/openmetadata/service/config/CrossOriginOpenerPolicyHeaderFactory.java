/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import org.openmetadata.service.config.web.HeaderFactory;

public class CrossOriginOpenerPolicyHeaderFactory extends HeaderFactory {
  public static final String CROSS_ORIGIN_OPENER_POLICY_HEADER = "Cross-Origin-Opener-Policy";

  @JsonProperty("option")
  private String option;

  public CrossOriginOpenerPolicyHeaderFactory() {}

  public String getOption() {
    return this.option;
  }

  public void setOption(String option) {
    this.option = option;
  }

  @Override
  protected Map<String, String> buildHeaders() {
    return Collections.singletonMap(CROSS_ORIGIN_OPENER_POLICY_HEADER, this.option);
  }
}
