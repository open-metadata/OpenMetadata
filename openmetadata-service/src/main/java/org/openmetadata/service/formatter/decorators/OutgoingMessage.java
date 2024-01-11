package org.openmetadata.service.formatter.decorators;

import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OutgoingMessage {
  private String userName;
  private String header;
  private List<String> messages;
}
