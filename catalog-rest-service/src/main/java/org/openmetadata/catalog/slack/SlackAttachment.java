package org.openmetadata.catalog.slack;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SlackAttachment {
  private String fallback;
  private String color;
  private String pretext;

  @JsonProperty("author_name")
  private String authorName;

  @JsonProperty("author_link")
  private String authorLink;

  @JsonProperty("author_icon")
  private String authorIcon;

  private String title;

  @JsonProperty("title_link")
  private String titleLink;

  private String text;
  private Field[] fields;

  @JsonProperty("image_url")
  private String imageUrl;

  @JsonProperty("thumb_url")
  private String thumbUrl;

  private String footer;

  @JsonProperty("footer_icon")
  private String footerIcon;

  private String ts;

  @JsonProperty("mrkdwn_in")
  private List<String> markdownIn;

  public String getFallback() {
    return fallback;
  }

  public void setFallback(String fallback) {
    this.fallback = fallback;
  }

  public String getColor() {
    return color;
  }

  public void setColor(String color) {
    this.color = color;
  }

  public String getPretext() {
    return pretext;
  }

  public void setPretext(String pretext) {
    this.pretext = pretext;
  }

  public String getAuthorName() {
    return authorName;
  }

  public void setAuthorName(String authorName) {
    this.authorName = authorName;
  }

  public String getAuthorLink() {
    return authorLink;
  }

  public void setAuthorLink(String authorLink) {
    this.authorLink = authorLink;
  }

  public String getAuthorIcon() {
    return authorIcon;
  }

  public void setAuthorIcon(String authorIcon) {
    this.authorIcon = authorIcon;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getTitleLink() {
    return titleLink;
  }

  public void setTitleLink(String titleLink) {
    this.titleLink = titleLink;
  }

  public String getText() {
    return text;
  }

  public void setText(String text) {
    this.text = text;
  }

  public Field[] getFields() {
    return fields;
  }

  public void setFields(Field[] fields) {
    this.fields = fields;
  }

  public String getImageUrl() {
    return imageUrl;
  }

  public void setImageUrl(String imageUrl) {
    this.imageUrl = imageUrl;
  }

  public String getThumbUrl() {
    return thumbUrl;
  }

  public void setThumbUrl(String thumbUrl) {
    this.thumbUrl = thumbUrl;
  }

  public String getFooter() {
    return footer;
  }

  public void setFooter(String footer) {
    this.footer = footer;
  }

  public String getFooterIcon() {
    return footerIcon;
  }

  public void setFooterIcon(String footerIcon) {
    this.footerIcon = footerIcon;
  }

  public String getTs() {
    return ts;
  }

  public void setTs(String ts) {
    this.ts = ts;
  }

  public List<String> getMarkdownIn() {
    return markdownIn;
  }

  public void setMarkdownIn(List<String> markdownIn) {
    this.markdownIn = markdownIn;
  }
}
