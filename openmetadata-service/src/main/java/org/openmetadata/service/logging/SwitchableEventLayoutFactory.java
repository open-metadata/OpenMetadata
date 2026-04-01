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

package org.openmetadata.service.logging;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.LayoutBase;
import com.fasterxml.jackson.annotation.JsonTypeName;
import io.dropwizard.logging.common.DropwizardLayout;
import io.dropwizard.logging.json.EventJsonLayoutBaseFactory;
import java.util.TimeZone;

@JsonTypeName("om-event-layout")
public class SwitchableEventLayoutFactory extends AbstractSwitchableLayoutFactory<ILoggingEvent> {
  @Override
  protected LayoutBase<ILoggingEvent> buildTextLayout(LoggerContext context, TimeZone timeZone) {
    DropwizardLayout layout = new DropwizardLayout(context, timeZone);
    if (hasPattern()) {
      layout.setPattern(getPatternValue());
    }
    return layout;
  }

  @Override
  protected LayoutBase<ILoggingEvent> buildJsonLayout(LoggerContext context, TimeZone timeZone) {
    EventJsonLayoutBaseFactory layoutFactory = new EventJsonLayoutBaseFactory();
    layoutFactory.setAppendLineSeparator(isAppendLineSeparatorEnabled());
    if (hasAdditionalFields()) {
      layoutFactory.setAdditionalFields(getAdditionalFieldsValue());
    }
    return layoutFactory.build(context, timeZone);
  }
}
