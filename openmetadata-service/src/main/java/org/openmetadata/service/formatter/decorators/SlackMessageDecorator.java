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

package org.openmetadata.service.formatter.decorators;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqn;

import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import com.slack.api.model.block.composition.PlainTextObject;
import com.slack.api.model.block.composition.TextObject;
import com.slack.api.model.block.element.ImageElement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.util.email.EmailUtil;

public class SlackMessageDecorator implements MessageDecorator<SlackMessage> {

  @Override
  public String getBold() {
    return "*%s*";
  }

  @Override
  public String getBoldWithSpace() {
    return "*%s* ";
  }

  @Override
  public String getLineBreak() {
    return "\n";
  }

  @Override
  public String getAddMarker() {
    return "*";
  }

  @Override
  public String getAddMarkerClose() {
    return "*";
  }

  @Override
  public String getRemoveMarker() {
    return "~";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "~";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    String encodedFqn = encodeEntityFqn(fqn);
    return String.format(
        "<%s/%s/%s%s|%s>",
        EmailUtil.getOMBaseURL(),
        prefix,
        encodedFqn, // Use encoded FQN in the URL
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams),
        fqn.trim() // Display text remains unencoded
        );
  }

  @Override
  public SlackMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return getSlackMessage(event, createEntityMessage(publisherName, event));
  }

  @Override
  public SlackMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return getSlackMessage(event, createThreadMessage(publisherName, event));
  }

  @Override
  public SlackMessage buildTestMessage() {
    return createConnectionTestMessage();
  }

  private SlackMessage getSlackMessage(ChangeEvent event, OutgoingMessage outgoingMessage) {
    if (outgoingMessage.getMessages().isEmpty()) {
      throw new UnhandledServerException("No messages found for the event");
    }

    return createMessage(event, outgoingMessage);
  }

  private SlackMessage createMessage(ChangeEvent event, OutgoingMessage outgoingMessage) {
    return switch (event.getEntityType()) {
      case Entity.TEST_CASE -> createTestCaseMessage(event, outgoingMessage);
      default -> createGeneralChangeEventMessage(event, outgoingMessage);
    };
  }

  private SlackMessage createTestCaseMessage(ChangeEvent event, OutgoingMessage outgoingMessage) {
    final String testCaseResult = "testCaseResult";
    List<FieldChange> fieldsAdded = event.getChangeDescription().getFieldsAdded();
    List<FieldChange> fieldsUpdated = event.getChangeDescription().getFieldsUpdated();

    boolean hasRelevantChange =
        fieldsAdded.stream().anyMatch(field -> testCaseResult.equals(field.getName()))
            || fieldsUpdated.stream().anyMatch(field -> testCaseResult.equals(field.getName()));

    return hasRelevantChange
        ? createDQTemplateMessage(event, outgoingMessage)
        : createGeneralChangeEventMessage(event, outgoingMessage);
  }

  public SlackMessage createConnectionTestMessage() {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header Block
    blocks.add(
        Blocks.header(
            header ->
                header.text(
                    PlainTextObject.builder()
                        .text("Connection Successful :white_check_mark: ")
                        .build())));

    // Section Block 1 (Test Message)
    blocks.add(
        Blocks.section(
            section -> section.text(BlockCompositions.markdownText(CONNECTION_TEST_DESCRIPTION))));

    // Divider Block
    blocks.add(Blocks.divider());

    // context
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder().imageUrl(getOMImage()).altText("oss icon").build(),
                        BlockCompositions.markdownText(applyBoldFormat("OpenMetadata"))))));

    SlackMessage.Attachment attachment = new SlackMessage.Attachment();
    attachment.setColor("#36a64f"); // green
    attachment.setBlocks(blocks);

    SlackMessage message = new SlackMessage();
    message.setAttachments(Collections.singletonList(attachment));

    return message;
  }

  private SlackMessage createGeneralChangeEventMessage(
      ChangeEvent event, OutgoingMessage outgoingMessage) {
    List<LayoutBlock> generalChangeEventBody = createGeneralChangeEventBody(event, outgoingMessage);
    SlackMessage message = new SlackMessage();
    message.setBlocks(generalChangeEventBody);
    return message;
  }

  private List<LayoutBlock> createGeneralChangeEventBody(
      ChangeEvent event, OutgoingMessage outgoingMessage) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    addChangeEventDetailsHeader(blocks);

    // Info about the event
    List<TextObject> first_field = new ArrayList<>();
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Event Type:") + event.getEventType()));
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Updated By:") + event.getUserName()));
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Entity Type:") + event.getEntityType()));
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Time:") + new Date(event.getTimestamp())));

    // Split fields into multiple sections to avoid block limits
    for (int i = 0; i < first_field.size(); i += 10) {
      List<TextObject> sublist = first_field.subList(i, Math.min(i + 10, first_field.size()));
      blocks.add(Blocks.section(section -> section.fields(sublist)));
    }

    String fqnForChangeEventEntity = MessageDecorator.getFQNForChangeEventEntity(event);

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        applyBoldFormatWithSpace("FQN:") + fqnForChangeEventEntity))));

    // divider
    blocks.add(Blocks.divider());

    // desc about the event
    List<String> thread_messages = outgoingMessage.getMessages();
    thread_messages.forEach(
        (message) -> {
          blocks.add(
              Blocks.section(
                  section -> section.text(BlockCompositions.markdownText("> " + message))));
        });

    // Divider
    blocks.add(Blocks.divider());

    // View event link
    String entityUrl = buildClickableEntityUrl(outgoingMessage.getEntityUrl());

    blocks.add(Blocks.section(section -> section.text(BlockCompositions.markdownText(entityUrl))));

    // Context Block
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder().imageUrl(getOMImage()).altText("oss icon").build(),
                        BlockCompositions.markdownText(TEMPLATE_FOOTER)))));
    return blocks;
  }

  private void createDQHeading(
      List<LayoutBlock> blocks, Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {
    Map<Enum<?>, Object> testCaseResults = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);

    if (nullOrEmpty(testCaseResults)) {
      addChangeEventDetailsHeader(blocks);
    } else {
      String statusWithEmoji =
          getStatusWithEmoji(testCaseResults.get(DQ_TestCaseResultKeys.STATUS));
      Map<Enum<?>, Object> testCaseDetails =
          templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
      String testName = String.valueOf(testCaseDetails.get(DQ_TestCaseDetailsKeys.NAME));
      String message = String.format("\"%s\" test having status: %s", testName, statusWithEmoji);
      blocks.add(Blocks.header(header -> header.text(BlockCompositions.plainText(message))));
    }
  }

  private List<LayoutBlock> createDQBodyBlocks(
      ChangeEvent event,
      OutgoingMessage outgoingMessage,
      Map<DQ_Template_Section, Map<Enum<?>, Object>> data) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    createDQHeading(blocks, data);

    // Info about the event
    List<TextObject> first_field = new ArrayList<>();
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Event Type:") + event.getEventType()));
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Updated By:") + event.getUserName()));
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Entity Type:") + event.getEntityType()));
    first_field.add(
        BlockCompositions.markdownText(
            applyBoldFormatWithSpace("Time:") + new Date(event.getTimestamp())));

    // Split fields into multiple sections to avoid block limits
    for (int i = 0; i < first_field.size(); i += 10) {
      List<TextObject> sublist = first_field.subList(i, Math.min(i + 10, first_field.size()));
      blocks.add(Blocks.section(section -> section.fields(sublist)));
    }

    String fqnForChangeEventEntity = MessageDecorator.getFQNForChangeEventEntity(event);

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        applyBoldFormatWithSpace("FQN:") + fqnForChangeEventEntity))));

    // divider
    blocks.add(Blocks.divider());

    // desc about the event
    List<String> thread_messages = outgoingMessage.getMessages();
    thread_messages.forEach(
        (message) -> {
          blocks.add(
              Blocks.section(
                  section -> section.text(BlockCompositions.markdownText("> " + message))));
        });

    // Divider
    blocks.add(Blocks.divider());

    // View event link
    String entityUrl = buildClickableEntityUrl(outgoingMessage.getEntityUrl());

    blocks.add(Blocks.section(section -> section.text(BlockCompositions.markdownText(entityUrl))));

    // Context Block
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder().imageUrl(getOMImage()).altText("oss icon").build(),
                        BlockCompositions.markdownText(TEMPLATE_FOOTER)))));
    return blocks;
  }

  // DQ TEMPLATE
  public SlackMessage createDQTemplateMessage(ChangeEvent event, OutgoingMessage outgoingMessage) {

    Map<DQ_Template_Section, Map<Enum<?>, Object>> dqTemplateData =
        MessageDecorator.buildDQTemplateData(event, outgoingMessage);

    List<LayoutBlock> body = createDQBodyBlocks(event, outgoingMessage, dqTemplateData);

    SlackMessage message = new SlackMessage();
    message.setBlocks(body);

    Map<Enum<?>, Object> enumObjectMap = dqTemplateData.get(DQ_Template_Section.TEST_CASE_RESULT);
    if (!nullOrEmpty(enumObjectMap)) {
      SlackMessage.Attachment attachment = createDQAttachment(dqTemplateData);

      attachment.setColor("#ffcc00");

      message.setAttachments(Collections.singletonList(attachment));
    }

    return message;
  }

  private String determineColorBasedOnStatus(Object object) {
    if (object instanceof TestCaseStatus status) {
      return switch (status) {
        case Success -> "#36a64f"; // Green for success
        case Failed -> "#ff0000"; // Red for failure
        case Aborted -> "#ffcc00"; // Yellow for aborted
        case Queued -> "#439FE0"; // Blue for queued
        default -> "#808080"; // Gray for unknown or default cases
      };
    }
    return "#808080"; // Default to gray if the object is not a valid TestCaseStatus
  }

  private String getStatusWithEmoji(Object object) {
    if (object instanceof TestCaseStatus status) {
      return switch (status) {
        case Success -> "Success :white_check_mark:"; // Green checkmark for success
        case Failed -> "Failed :x:"; // Red cross for failure
        case Aborted -> "Aborted :warning:"; // Warning sign for aborted
        case Queued -> "Queued :hourglass_flowing_sand:"; // Hourglass for queued
        default -> "Unknown :grey_question:"; // Gray question mark for unknown cases
      };
    }
    return "Unknown :grey_question:"; // Default to unknown if the object is not a valid
    // TestCaseStatus
  }

  public SlackMessage.Attachment createDQAttachment(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> dqTemplateData) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header Block
    addDQAlertHeader(blocks);

    // Section 1 - Name
    addIdAndNameSection(blocks, dqTemplateData);

    // Section 2 - Owners and Tags
    addOwnersTagsSection(blocks, dqTemplateData);

    // Section 3 - Description
    addDescriptionSection(blocks, dqTemplateData);

    // Divider
    blocks.add(Blocks.divider());

    // Section 4 and 5 - Result and Test Definition
    blocks.addAll(createTestCaseResultAndDefinitionSections(dqTemplateData));

    // Context Block - Image and Markdown Text
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        ImageElement.builder().imageUrl(getOMImage()).altText("oss icon").build(),
                        BlockCompositions.markdownText("Change Event by OpenMetadata")))));

    SlackMessage.Attachment attachment = new SlackMessage.Attachment();
    attachment.setBlocks(blocks);

    return attachment;
  }

  // Updated Method to Create Both Sections
  private List<LayoutBlock> createTestCaseResultAndDefinitionSections(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {
    List<LayoutBlock> blocks = new ArrayList<>();

    if (templateData.containsKey(DQ_Template_Section.TEST_CASE_RESULT)
        && templateData.containsKey(DQ_Template_Section.TEST_DEFINITION)) {
      blocks.addAll(createTestCaseResultSections(templateData));
      blocks.addAll(createTestDefinitionSections(templateData));
    }

    return blocks;
  }

  private void addIdAndNameSection(
      List<LayoutBlock> blocks, Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return;
    }

    List<TextObject> idNameFields =
        Stream.of(
                createFieldText(
                    "Name :", testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.NAME, "-")))
            .collect(Collectors.toList());

    blocks.add(Blocks.section(section -> section.fields(idNameFields)));
  }

  private void addDescriptionSection(
      List<LayoutBlock> blocks, Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return;
    }

    TextObject idNameFields =
        createFieldTextWithNewLine(
            "Description", testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.DESCRIPTION, "-"));
    blocks.add(Blocks.section(section -> section.text(idNameFields)));
  }

  private void addOwnersTagsSection(
      List<LayoutBlock> blocks, Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return;
    }

    List<TextObject> ownerTagFields =
        Stream.of(
                createFieldTextWithNewLine("Owners", formatOwners(testCaseDetails)),
                createFieldTextWithNewLine("Tags", formatTags(testCaseDetails)))
            .collect(Collectors.toList());

    blocks.add(Blocks.section(section -> section.fields(ownerTagFields)));
  }

  @SuppressWarnings("unchecked")
  private String formatOwners(Map<Enum<?>, Object> testCaseDetails) {
    List<EntityReference> owners =
        (List<EntityReference>)
            testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.OWNERS, Collections.emptyList());

    StringBuilder ownersStringified = new StringBuilder();
    if (!CommonUtil.nullOrEmpty(owners)) {
      owners.forEach(
          owner -> {
            if (owner != null && owner.getName() != null) {
              ownersStringified.append(owner.getName()).append(", ");
            }
          });

      // Remove the trailing comma and space if there's content
      if (!ownersStringified.isEmpty()) {
        ownersStringified.setLength(ownersStringified.length() - 2);
      }
    } else {
      ownersStringified.append("-");
    }

    return ownersStringified.toString();
  }

  @SuppressWarnings("unchecked")
  private String formatTags(Map<Enum<?>, Object> testCaseDetails) {
    List<TagLabel> tags =
        (List<TagLabel>)
            testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.TAGS, Collections.emptyList());

    StringBuilder tagsStringified = new StringBuilder();
    if (!CommonUtil.nullOrEmpty(tags)) {
      tags.forEach(
          tag -> {
            if (tag != null && tag.getName() != null) {
              tagsStringified.append(tag.getName()).append(", ");
            }
          });

      // Remove the trailing comma and space if there's content
      if (!tagsStringified.isEmpty()) {
        tagsStringified.setLength(tagsStringified.length() - 2);
      }
    } else {
      tagsStringified.append("-");
    }

    return tagsStringified.toString();
  }

  private List<LayoutBlock> createTestCaseResultSections(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    List<LayoutBlock> blocks = new ArrayList<>();

    Map<Enum<?>, Object> testCaseResults = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);
    if (nullOrEmpty(testCaseResults)) {
      return blocks;
    }

    // Test Case Result Header
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(applyBoldFormat(":mag: TEST CASE RESULT")))));

    // Status and Parameter Value
    addStatusAndParameterValueSection(blocks, testCaseResults);

    // Result Message Section
    blocks.add(
        Blocks.section(
            section -> section.text(BlockCompositions.markdownText(applyBoldFormat("Result")))));

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        formatWithTripleBackticksForEnumMap(
                            DQ_TestCaseResultKeys.RESULT_MESSAGE, testCaseResults)))));

    // parameter section
    createParameterValueBlocks(templateData, blocks);

    // inspection section
    addInspectionQuerySection(templateData, blocks);

    blocks.add(Blocks.divider());
    return blocks;
  }

  private void addStatusAndParameterValueSection(
      List<LayoutBlock> blocks, Map<Enum<?>, Object> testCaseResults) {
    List<TextObject> statusParameterFields =
        Stream.of(
                BlockCompositions.markdownText(
                    applyBoldFormatWithSpace("Status -")
                        + getStatusWithEmoji(
                            testCaseResults.getOrDefault(DQ_TestCaseResultKeys.STATUS, "-"))))
            .collect(Collectors.toList());

    blocks.add(Blocks.section(section -> section.fields(statusParameterFields)));
  }

  @SuppressWarnings("unchecked")
  private void createParameterValueBlocks(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<LayoutBlock> blocks) {

    Map<Enum<?>, Object> testCaseResults = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);
    if (nullOrEmpty(testCaseResults)) {
      return;
    }

    Object result = testCaseResults.get(DQ_TestCaseResultKeys.PARAMETER_VALUE);
    List<TestCaseParameterValue> parameterValues =
        result instanceof List<?> ? (List<TestCaseParameterValue>) result : null;

    if (nullOrEmpty(parameterValues)) {
      return;
    }

    blocks.add(
        Blocks.section(
            section ->
                section.text(BlockCompositions.markdownText(applyBoldFormat("Parameter Value")))));

    String parameterValuesText =
        parameterValues.stream()
            .map(pv -> String.format("[%s: %s]", pv.getName(), pv.getValue()))
            .collect(Collectors.joining(", "));

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        formatWithTripleBackticks(parameterValuesText)))));
  }

  private void addInspectionQuerySection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<LayoutBlock> blocks) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);

    if (nullOrEmpty(testCaseDetails)
        || !testCaseDetails.containsKey(DQ_TestCaseDetailsKeys.INSPECTION_QUERY)) {
      return;
    }

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        applyBoldFormat(":hammer_and_wrench: Inspection Query")))));

    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        formatWithTripleBackticksForEnumMap(
                            DQ_TestCaseDetailsKeys.INSPECTION_QUERY, testCaseDetails)))));
  }

  // Method to create Test Definition Sections
  private List<LayoutBlock> createTestDefinitionSections(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    List<LayoutBlock> blocks = new ArrayList<>();

    if (templateData.containsKey(DQ_Template_Section.TEST_DEFINITION)) {
      Map<Enum<?>, Object> testDefinition = templateData.get(DQ_Template_Section.TEST_DEFINITION);

      if (!nullOrEmpty(testDefinition)) {

        // Test Definition Header
        blocks.add(
            Blocks.section(
                section ->
                    section.text(
                        BlockCompositions.markdownText(
                            applyBoldFormat(":bulb: TEST DEFINITION")))));
        blocks.add(
            Blocks.section(
                section -> section.text(BlockCompositions.markdownText(applyBoldFormat("Name")))));
        blocks.add(
            Blocks.section(
                section ->
                    section.text(
                        BlockCompositions.markdownText(
                            formatWithTripleBackticksForEnumMap(
                                DQ_TestDefinitionKeys.TEST_DEFINITION_NAME, testDefinition)))));

        // Section - Description with triple backticks
        blocks.add(
            Blocks.section(
                section ->
                    section.text(BlockCompositions.markdownText(applyBoldFormat("Description")))));
        blocks.add(
            Blocks.section(
                section ->
                    section.text(
                        BlockCompositions.markdownText(
                            formatWithTripleBackticksForEnumMap(
                                DQ_TestDefinitionKeys.TEST_DEFINITION_DESCRIPTION,
                                testDefinition)))));

        addSampleDataSection(templateData, blocks);

        blocks.add(Blocks.divider());
      }
    }

    return blocks;
  }

  private void addSampleDataSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<LayoutBlock> blocks) {

    if (templateData.containsKey(DQ_Template_Section.TEST_CASE_DETAILS)) {
      Map<Enum<?>, Object> testCaseDetails =
          templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);

      if (!nullOrEmpty(testCaseDetails)) {
        blocks.add(
            Blocks.section(
                section ->
                    section.text(BlockCompositions.markdownText(applyBoldFormat("Sample Data")))));

        blocks.add(
            Blocks.section(
                section ->
                    section.text(
                        BlockCompositions.markdownText(
                            formatWithTripleBackticksForEnumMap(
                                DQ_TestCaseDetailsKeys.SAMPLE_DATA, testCaseDetails)))));
      }
    }
  }

  private String buildClickableEntityUrl(String entityUrl) {
    if (entityUrl.startsWith("<") && entityUrl.endsWith(">")) {
      entityUrl = entityUrl.substring(1, entityUrl.length() - 1);
    }

    int pipeIndex = entityUrl.indexOf("|");
    if (pipeIndex != -1) {
      entityUrl = entityUrl.substring(0, pipeIndex);
    }

    return String.format("Access data: <%s|View>", entityUrl);
  }

  private TextObject createFieldTextWithNewLine(String label, Object value) {
    return BlockCompositions.markdownText(applyBoldFormatWithNewLine(label) + value);
  }

  private TextObject createFieldText(String label, Object value) {
    return BlockCompositions.markdownText(applyBoldFormatWithSpace(label) + value);
  }

  private void addChangeEventDetailsHeader(List<LayoutBlock> blocks) {
    blocks.add(
        Blocks.header(
            header ->
                header.text(
                    BlockCompositions.plainText(
                        ":arrows_counterclockwise: Change Event Details"))));
  }

  private void addDQAlertHeader(List<LayoutBlock> blocks) {
    blocks.add(
        Blocks.section(
            section -> section.text(BlockCompositions.markdownText(applyBoldFormat("TEST CASE")))));
  }

  private String applyBoldFormat(String title) {
    return String.format(getBold(), title);
  }

  private String applyBoldFormatWithSpace(String title) {
    return String.format(getBoldWithSpace(), title);
  }

  private String applyBoldFormatWithNewLine(String title) {
    return applyBoldFormat(title) + "\n";
  }

  private String formatWithTripleBackticksForEnumMap(
      Enum<?> key, Map<Enum<?>, Object> placeholders) {
    Object value = placeholders.getOrDefault(key, "-");
    return "```" + value + "```";
  }

  private String formatWithTripleBackticks(String text) {
    return "```" + text + "```";
  }

  private String getOMImage() {
    return "https://i.postimg.cc/0jYLNmM1/image.png";
  }
}
