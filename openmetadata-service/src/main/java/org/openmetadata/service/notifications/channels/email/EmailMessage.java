package org.openmetadata.service.notifications.channels.email;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.notifications.channels.NotificationMessage;

@Getter
@Setter
@Builder
public class EmailMessage implements NotificationMessage {
  private String subject;
  private String htmlContent;
  private String plainTextContent;
}
