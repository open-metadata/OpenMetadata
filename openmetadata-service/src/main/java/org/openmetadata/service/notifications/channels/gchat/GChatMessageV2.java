package org.openmetadata.service.notifications.channels.gchat;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.openmetadata.service.notifications.channels.NotificationMessage;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(Include.NON_NULL)
public class GChatMessageV2 implements NotificationMessage {

  private List<CardV2> cardsV2;

  public static GChatMessageV2 ofSingleCard(Card card) {
    List<CardV2> v2 = new ArrayList<>(1);
    v2.add(new CardV2(null, card));
    return new GChatMessageV2(v2);
  }

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @Builder
  @JsonInclude(Include.NON_NULL)
  public static class CardV2 {
    private String cardId;
    private Card card;
  }

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @Builder
  @JsonInclude(Include.NON_NULL)
  public static class Card {
    private Header header;
    private List<Section> sections;

    public List<Section> getSections() {
      if (sections == null) sections = new ArrayList<>();
      return sections;
    }
  }

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @Builder
  @JsonInclude(Include.NON_NULL)
  public static class Header {
    private String title;
    private String subtitle;
    private String imageUrl;
    private ImageType imageType;

    public Header(String title, String imageUrl, String unusedImageStyle) {
      this.title = title;
      this.imageUrl = imageUrl;
      this.imageType = null;
      this.subtitle = null;
    }

    public enum ImageType {
      SQUARE,
      CIRCLE
    }
  }

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @Builder
  @JsonInclude(Include.NON_NULL)
  public static class Section {
    private List<Widget> widgets;

    public List<Widget> getWidgets() {
      if (widgets == null) widgets = new ArrayList<>();
      return widgets;
    }
  }

  @Data
  @NoArgsConstructor
  @JsonInclude(Include.NON_NULL)
  public static class Widget {
    private TextParagraph textParagraph;
    private Image image;
    private Divider divider;

    public static Widget text(String text) {
      Widget w = new Widget();
      w.textParagraph = new TextParagraph(text, TextParagraph.TextSyntax.MARKDOWN);
      return w;
    }

    public static Widget image(String imageUrl, String altText) {
      Widget w = new Widget();
      w.image = new Image(imageUrl, altText);
      return w;
    }

    public static Widget divider() {
      Widget w = new Widget();
      w.divider = new Divider();
      return w;
    }
  }

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @JsonInclude(Include.NON_NULL)
  public static class TextParagraph {
    private String text;
    private TextSyntax textSyntax; // HTML (default) or MARKDOWN

    public enum TextSyntax {
      HTML,
      MARKDOWN
    }
  }

  @Data
  @NoArgsConstructor
  @JsonInclude(Include.NON_NULL)
  public static class Divider {}

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @JsonInclude(Include.NON_NULL)
  public static class Image {
    private String imageUrl;
    private String altText;
  }
}
