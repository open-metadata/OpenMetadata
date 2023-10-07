package org.openmetadata.service.events.subscription.gchat;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

public class GChatMessage {

  @Getter @Setter private String text;
  @Getter @Setter private List<CardsV2> cardsV2;

  public static class CardsV2 {
    @Getter @Setter private String cardId;
    @Getter @Setter private Card card;
  }

  public static class Card {

    @Getter @Setter private CardHeader header;
    @Getter @Setter private List<Section> sections;
  }

  public static class CardHeader {
    @Getter @Setter private String title;
    @Getter @Setter private String subtitle;
  }

  public static class Section {
    @Getter @Setter private List<Widget> widgets;
  }

  public static class Widget {
    @Getter @Setter private TextParagraph textParagraph;
  }

  @AllArgsConstructor
  public static class TextParagraph {
    @Getter @Setter private String text;
  }
}
