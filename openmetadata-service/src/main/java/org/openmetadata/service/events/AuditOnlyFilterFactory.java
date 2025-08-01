package org.openmetadata.service.events;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.filter.Filter;
import ch.qos.logback.core.spi.FilterReply;
import com.fasterxml.jackson.annotation.JsonTypeName;
import io.dropwizard.logging.common.filter.FilterFactory;
import org.slf4j.Marker;

@JsonTypeName("audit-only-filter-factory")
public class AuditOnlyFilterFactory implements FilterFactory<ILoggingEvent> {
  private static final Filter<ILoggingEvent> auditFilter =
      new Filter<>() {
        @Override
        public FilterReply decide(final ILoggingEvent event) {
          Marker marker = event.getMarker();
          if (marker != null && "AUDIT".equals(marker.getName())) {
            return FilterReply.ACCEPT;
          }
          return FilterReply.DENY;
        }
      };

  @Override
  public Filter<ILoggingEvent> build() {
    return auditFilter;
  }
}
