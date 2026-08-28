package org.openmetadata.service.formatter.field;

import static org.openmetadata.service.Entity.FIELD_ASSETS;

import org.openmetadata.schema.entity.feed.AssetsFeedInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormattedMessage;

public class AssetsFieldFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s the assets in %s %s";

  public AssetsFieldFormatter(
      MessageDecorator<?> messageDecorator, FormattedMessage thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
  }

  @Override
  public String formatAddedField() {
    String message = getHeaderForAssetsUpdate(FormattedMessage.FieldOperation.ADDED.value());
    // Update the thread with the required information
    populateAssetsFeedInfo(FormattedMessage.FieldOperation.ADDED, message);
    return message;
  }

  @Override
  public String formatDeletedField() {
    String message = getHeaderForAssetsUpdate(FormattedMessage.FieldOperation.DELETED.value());
    // Update the thread with the required information
    populateAssetsFeedInfo(FormattedMessage.FieldOperation.DELETED, message);
    return message;
  }

  private void populateAssetsFeedInfo(
      FormattedMessage.FieldOperation operation, String threadMessage) {
    AssetsFeedInfo assetsFeedInfo =
        new AssetsFeedInfo()
            .withUpdatedAssets(
                JsonUtils.readOrConvertValues(fieldChange.getNewValue(), EntityReference.class));
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(threadMessage)
            .withFieldName(FIELD_ASSETS)
            .withEntitySpecificInfo(assetsFeedInfo);
    populateThreadFeedInfo(
        thread, threadMessage, FormattedMessage.CardStyle.ASSETS, operation, feedInfo);
  }

  private String getHeaderForAssetsUpdate(String opMessage) {
    return String.format(
        HEADER_MESSAGE,
        thread.getUpdatedBy(),
        opMessage,
        thread.getEntityRef().getType(),
        thread.getEntityUrlLink());
  }
}
