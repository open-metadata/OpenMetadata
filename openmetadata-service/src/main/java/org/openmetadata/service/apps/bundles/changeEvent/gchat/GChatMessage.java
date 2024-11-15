package org.openmetadata.service.apps.bundles.changeEvent.gchat;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GChatMessage {

  private List<GChatMessage.Card> cards;

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Card {
    private GChatMessage.Header header;
    private List<GChatMessage.Section> sections;
  }

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Header {
    private String title;
    private String imageUrl;
    private String imageStyle;
  }

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Section {
    private List<GChatMessage.Widget> widgets;
  }

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Widget {
    private GChatMessage.KeyValue keyValue;
    private GChatMessage.TextParagraph textParagraph;

    public Widget(GChatMessage.KeyValue keyValue) {
      this.keyValue = keyValue;
    }

    public Widget(GChatMessage.TextParagraph textParagraph) {
      this.textParagraph = textParagraph;
    }
  }

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class KeyValue {
    private String topLabel;
    private String content;
  }

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  public static class TextParagraph {
    private String text;
  }
}
