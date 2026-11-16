package org.openmetadata.service.alerting.channel.email;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.alerting.content.render.NotificationMessage;

@Getter
@Setter
@Builder
public class EmailMessage implements NotificationMessage {
  private String subject;
  private String htmlContent;
  private String plainTextContent;
}
