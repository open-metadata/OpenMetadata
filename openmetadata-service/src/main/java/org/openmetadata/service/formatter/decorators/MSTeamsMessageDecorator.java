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
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.AdaptiveCardContent;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Attachment;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Column;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.ColumnSet;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.Image;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage.TextBlock;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.util.email.EmailUtil;

public class MSTeamsMessageDecorator implements MessageDecorator<TeamsMessage> {
  private static final String TEST_CASE_RESULT = "testCaseResult";

  @Override
  public String getBold() {
    return "**%s**";
  }

  @Override
  public String getBoldWithSpace() {
    return "**%s** ";
  }

  @Override
  public String getLineBreak() {
    return " <br/> ";
  }

  @Override
  public String getAddMarker() {
    return "**";
  }

  @Override
  public String getAddMarkerClose() {
    return "** ";
  }

  @Override
  public String getRemoveMarker() {
    return "~~";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "~~ ";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    String encodedFqn = encodeEntityFqnSafe(fqn);
    return String.format(
        "[%s](%s/%s/%s%s)",
        fqn.trim(),
        EmailUtil.getOMBaseURL(),
        prefix,
        encodedFqn,
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams));
  }

  @Override
  public TeamsMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return createMessage(publisherName, event, createEntityMessage(publisherName, event));
  }

  @Override
  public TeamsMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return createMessage(publisherName, event, createThreadMessage(publisherName, event));
  }

  @Override
  public TeamsMessage buildTestMessage() {
    return getTeamTestMessage();
  }

  public TeamsMessage getTeamTestMessage() {
    return createConnectionTestMessage();
  }

  private TeamsMessage createMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    if (outgoingMessage.getMessages().isEmpty()) {
      throw new UnhandledServerException("No messages found for the event");
    }

    String entityType = event.getEntityType();

    return switch (entityType) {
      case Entity.TEST_CASE -> createTestCaseMessage(publisherName, event, outgoingMessage);
      default -> createGeneralChangeEventMessage(publisherName, event, outgoingMessage);
    };
  }

  private TeamsMessage createTestCaseMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    List<FieldChange> fieldsAdded = event.getChangeDescription().getFieldsAdded();
    List<FieldChange> fieldsUpdated = event.getChangeDescription().getFieldsUpdated();

    boolean hasRelevantChange =
        fieldsAdded.stream().anyMatch(field -> TEST_CASE_RESULT.equals(field.getName()))
            || fieldsUpdated.stream().anyMatch(field -> TEST_CASE_RESULT.equals(field.getName()));

    return hasRelevantChange
        ? createDQMessage(event, outgoingMessage)
        : createGeneralChangeEventMessage(publisherName, event, outgoingMessage);
  }

  private TeamsMessage createGeneralChangeEventMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    Map<General_Template_Section, Map<Enum<?>, Object>> templateData =
        buildGeneralTemplateData(publisherName, event, outgoingMessage);

    Map<Enum<?>, Object> eventDetails = templateData.get(General_Template_Section.EVENT_DETAILS);

    TextBlock changeEventDetailsTextBlock = createHeader();

    // Create the facts for the FactSet
    List<TeamsMessage.Fact> facts = createEventDetailsFacts(eventDetails);

    // Create a list of TextBlocks for each message with a separator
    List<TextBlock> messageTextBlocks =
        outgoingMessage.getMessages().stream()
            .map(
                message ->
                    TextBlock.builder()
                        .type("TextBlock")
                        .text(message)
                        .wrap(true)
                        .spacing("Medium")
                        .separator(true)
                        .build())
            .toList();

    TextBlock footerMessage = createFooterMessage();

    ColumnSet columnSet = createHeaderColumnSet(changeEventDetailsTextBlock);

    // Create the body list and combine all elements
    List<TeamsMessage.BodyItem> body = new ArrayList<>();
    body.add(columnSet);
    body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(facts).build());
    body.addAll(messageTextBlocks); // Add the containers with message TextBlocks
    body.add(createEntityLink(outgoingMessage.getEntityUrl()));
    body.add(footerMessage);

    Attachment attachment =
        Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(
                AdaptiveCardContent.builder()
                    .type("AdaptiveCard")
                    .version("1.0")
                    .body(body) // Pass the combined body list
                    .build())
            .build();

    return TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();
  }

  private TeamsMessage createDQMessage(ChangeEvent event, OutgoingMessage outgoingMessage) {
    Map<DQ_Template_Section, Map<Enum<?>, Object>> dqTemplateData =
        MessageDecorator.buildDQTemplateData(event, outgoingMessage);

    TextBlock changeEventDetailsTextBlock = createHeader();

    Map<Enum<?>, Object> eventDetails = dqTemplateData.get(DQ_Template_Section.EVENT_DETAILS);

    // Create the facts for different sections
    List<TeamsMessage.Fact> facts = createEventDetailsFacts(eventDetails);
    List<TeamsMessage.Fact> testCaseDetailsFacts = createTestCaseDetailsFacts(dqTemplateData);
    List<TeamsMessage.Fact> testCaseResultFacts = createTestCaseResultFacts(dqTemplateData);

    List<TeamsMessage.Fact> parameterValuesFacts = createParameterValuesFacts(dqTemplateData);

    List<TeamsMessage.Fact> inspectionQueryFacts = createInspectionQueryFacts(dqTemplateData);
    List<TeamsMessage.Fact> testDefinitionFacts = createTestDefinitionFacts(dqTemplateData);
    List<TeamsMessage.Fact> sampleDataFacts = createSampleDataFacts(dqTemplateData);

    // Create a list of TextBlocks for each message with a separator
    List<TextBlock> messageTextBlocks =
        outgoingMessage.getMessages().stream()
            .map(
                message ->
                    TextBlock.builder()
                        .type("TextBlock")
                        .text(message)
                        .wrap(true)
                        .spacing("Medium")
                        .separator(true) // Set separator for each message
                        .build())
            .toList();

    TextBlock footerMessage = createFooterMessage();

    ColumnSet columnSet = createHeaderColumnSet(changeEventDetailsTextBlock);

    // Divider between sections
    TextBlock divider = createDivider();

    // Create the body list and combine all elements with dividers between fact sets
    List<TeamsMessage.BodyItem> body = new ArrayList<>();
    body.add(columnSet);

    // event details facts
    body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(facts).build());

    // Add the outgoing message text blocks
    body.addAll(messageTextBlocks);
    body.add(divider);

    // test case details facts
    if (dqTemplateData.containsKey(DQ_Template_Section.TEST_CASE_DETAILS)
        && !nullOrEmpty(testCaseDetailsFacts)) {
      body.add(createBoldTextBlock("Test Case Details"));
      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(testCaseDetailsFacts).build());
      body.add(divider);
    }

    // test case result facts
    if (dqTemplateData.containsKey(DQ_Template_Section.TEST_CASE_RESULT)
        && !nullOrEmpty(testCaseResultFacts)) {
      body.add(createBoldTextBlock("Test Case Result"));
      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(testCaseResultFacts).build());
      body.add(divider);
    }

    // parameterValues facts
    if (dqTemplateData.containsKey(DQ_Template_Section.TEST_CASE_DETAILS)
        && !nullOrEmpty(parameterValuesFacts)) {
      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(parameterValuesFacts).build());
    }

    // inspection query facts
    if (dqTemplateData.containsKey(DQ_Template_Section.TEST_CASE_DETAILS)
        && !nullOrEmpty(inspectionQueryFacts)) {
      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(inspectionQueryFacts).build());
      body.add(divider);
    }

    // test definition facts
    if (dqTemplateData.containsKey(DQ_Template_Section.TEST_DEFINITION)
        && !nullOrEmpty(testDefinitionFacts)) {
      body.add(createBoldTextBlock("Test Definition"));
      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(testDefinitionFacts).build());
      body.add(divider);
    }

    // Add sample data facts
    if (dqTemplateData.containsKey(DQ_Template_Section.TEST_CASE_DETAILS)
        && !nullOrEmpty(sampleDataFacts)) {
      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(sampleDataFacts).build());
    }

    body.add(createEntityLink(outgoingMessage.getEntityUrl()));

    body.add(footerMessage);

    // Create the attachment with the combined body list
    Attachment attachment =
        Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(
                AdaptiveCardContent.builder()
                    .type("AdaptiveCard")
                    .version("1.0")
                    .body(body) // Pass the combined body list
                    .build())
            .build();

    return TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();
  }

  private ColumnSet createHeaderColumnSet(TextBlock changeEventDetailsTextBlock) {
    return ColumnSet.builder()
        .type("ColumnSet")
        .columns(
            List.of(
                Column.builder()
                    .type("Column")
                    .items(List.of(createOMImageMessage())) // Create and add image message
                    .width("auto")
                    .build(),
                Column.builder()
                    .type("Column")
                    .items(List.of(changeEventDetailsTextBlock)) // Add change event details
                    .width("stretch")
                    .build()))
        .build();
  }

  private List<TeamsMessage.Fact> createEventDetailsFacts(Map<Enum<?>, Object> detailsMap) {
    return List.of(
        createFact("Event Type:", String.valueOf(detailsMap.get(EventDetailsKeys.EVENT_TYPE))),
        createFact("Updated By:", String.valueOf(detailsMap.get(EventDetailsKeys.UPDATED_BY))),
        createFact("Entity Type:", String.valueOf(detailsMap.get(EventDetailsKeys.ENTITY_TYPE))),
        createFact("Time:", String.valueOf(detailsMap.get(EventDetailsKeys.TIME))),
        createFact("FQN:", String.valueOf(detailsMap.get(EventDetailsKeys.ENTITY_FQN))));
  }

  private List<TeamsMessage.Fact> createTestCaseDetailsFacts(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);

    Function<DQ_TestCaseDetailsKeys, String> getDetail =
        key -> String.valueOf(testCaseDetails.getOrDefault(key, "-"));

    return Arrays.asList(
        createFact("ID:", getDetail.apply(DQ_TestCaseDetailsKeys.ID)),
        createFact("Name:", getDetail.apply(DQ_TestCaseDetailsKeys.NAME)),
        createFact("Owners:", formatOwners(testCaseDetails)),
        createFact("Tags:", formatTags(testCaseDetails)));
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

  private List<TeamsMessage.Fact> createTestCaseResultFacts(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);

    if (nullOrEmpty(testCaseDetails)) {
      return Collections.emptyList();
    }

    return Stream.of(
            createFact(
                "Status:",
                String.valueOf(testCaseDetails.getOrDefault(DQ_TestCaseResultKeys.STATUS, "-"))),
            createFact(
                "Result Message:",
                String.valueOf(
                    testCaseDetails.getOrDefault(DQ_TestCaseResultKeys.RESULT_MESSAGE, "-"))))
        .collect(Collectors.toList());
  }

  private List<TeamsMessage.Fact> createParameterValuesFacts(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);

    if (nullOrEmpty(testCaseDetails)) {
      return Collections.emptyList();
    }

    Object result = testCaseDetails.get(DQ_TestCaseResultKeys.PARAMETER_VALUE);
    if (!(result instanceof List<?>)) {
      return Collections.emptyList();
    }

    List<TestCaseParameterValue> parameterValues = (List<TestCaseParameterValue>) result;
    if (nullOrEmpty(parameterValues)) {
      return Collections.emptyList();
    }

    StringBuilder parameterValuesText = new StringBuilder();

    parameterValues.forEach(
        param -> {
          if (parameterValuesText.length() > 0) {
            parameterValuesText.append(", ");
          }

          parameterValuesText.append(String.format("[%s: %s]", param.getName(), param.getValue()));
        });

    // Return a fact for "Parameter Values" with all parameter values in a single string
    return Stream.of(createFact("Parameter Values:", parameterValuesText.toString()))
        .collect(Collectors.toList());
  }

  private List<TeamsMessage.Fact> createInspectionQueryFacts(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return Collections.emptyList();
    }

    Object inspectionQuery = testCaseDetails.get(DQ_TestCaseDetailsKeys.INSPECTION_QUERY);

    if (!nullOrEmpty(inspectionQuery)) {
      return Stream.of(createFact("Inspection Query:", String.valueOf(inspectionQuery)))
          .collect(Collectors.toList());
    }

    return Collections.emptyList();
  }

  private List<TeamsMessage.Fact> createTestDefinitionFacts(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_DEFINITION);
    if (nullOrEmpty(testCaseDetails)) {
      return Collections.emptyList();
    }

    return Stream.of(
            createFact(
                "Name:",
                String.valueOf(
                    testCaseDetails.getOrDefault(DQ_TestDefinitionKeys.TEST_DEFINITION_NAME, "-"))),
            createFact(
                "Description:",
                String.valueOf(
                    testCaseDetails.getOrDefault(
                        DQ_TestDefinitionKeys.TEST_DEFINITION_DESCRIPTION, "-"))))
        .collect(Collectors.toList());
  }

  private List<TeamsMessage.Fact> createSampleDataFacts(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return Collections.emptyList();
    }

    Object sampleData = testCaseDetails.get(DQ_TestCaseDetailsKeys.SAMPLE_DATA);
    if (nullOrEmpty(sampleData)) {
      return Collections.emptyList();
    }

    return Stream.of(createFact("Sample Data:", String.valueOf(sampleData)))
        .collect(Collectors.toList());
  }

  private TeamsMessage createConnectionTestMessage() {
    Image imageItem = createOMImageMessage();

    Column column1 =
        Column.builder().type("Column").width("auto").items(List.of(imageItem)).build();

    TextBlock textBlock1 = createTextBlock("Connection Successful \u2705", "Bolder", "Large");
    TextBlock textBlock2 = createTextBlock(CONNECTION_TEST_DESCRIPTION, null, null);

    Column column2 =
        Column.builder()
            .type("Column")
            .width("stretch")
            .items(List.of(textBlock1, textBlock2))
            .build();

    ColumnSet columnSet =
        ColumnSet.builder().type("ColumnSet").columns(List.of(column1, column2)).build();

    // Create the footer text block
    TextBlock footerTextBlock = createTextBlock("OpenMetadata", "Lighter", "Small");
    footerTextBlock.setHorizontalAlignment("Center");
    footerTextBlock.setSpacing("Medium");
    footerTextBlock.setSeparator(true);

    AdaptiveCardContent adaptiveCardContent =
        AdaptiveCardContent.builder()
            .type("AdaptiveCard")
            .version("1.0")
            .body(List.of(columnSet, footerTextBlock))
            .build();

    Attachment attachment =
        Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(adaptiveCardContent)
            .build();

    return TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();
  }

  private Map<General_Template_Section, Map<Enum<?>, Object>> buildGeneralTemplateData(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    TemplateDataBuilder<General_Template_Section> builder = new TemplateDataBuilder<>();

    // Use General_Template_Section directly
    builder
        .add(
            General_Template_Section.EVENT_DETAILS,
            EventDetailsKeys.EVENT_TYPE,
            event.getEventType().value())
        .add(
            General_Template_Section.EVENT_DETAILS,
            EventDetailsKeys.UPDATED_BY,
            event.getUserName())
        .add(
            General_Template_Section.EVENT_DETAILS,
            EventDetailsKeys.ENTITY_TYPE,
            event.getEntityType())
        .add(
            General_Template_Section.EVENT_DETAILS,
            EventDetailsKeys.ENTITY_FQN,
            MessageDecorator.getFQNForChangeEventEntity(event))
        .add(
            General_Template_Section.EVENT_DETAILS,
            EventDetailsKeys.TIME,
            new Date(event.getTimestamp()).toString())
        .add(
            General_Template_Section.EVENT_DETAILS,
            EventDetailsKeys.OUTGOING_MESSAGE,
            outgoingMessage);

    return builder.build();
  }

  private TextBlock createHeader() {
    return TextBlock.builder()
        .type("TextBlock")
        .text(applyBoldFormat("Change Event Details"))
        .size("Large")
        .weight("Bolder")
        .wrap(true)
        .build();
  }

  private TextBlock createEntityLink(String url) {
    if (nullOrEmpty(url)) {
      throw new IllegalArgumentException("URL cannot be null or empty");
    }

    // Replace the text part (if it's in markdown link format [some text](url))
    String updatedUrl = url.replaceAll("\\[.*?\\]\\((.*?)\\)", "[View Data]($1)");

    return TextBlock.builder()
        .type("TextBlock")
        .text(updatedUrl)
        .wrap(true)
        .spacing("Medium")
        .separator(false)
        .build();
  }

  private TextBlock createTextBlock(String text, String weight, String size) {
    return TextBlock.builder()
        .type("TextBlock")
        .text(text)
        .weight(weight)
        .size(size)
        .wrap(true)
        .build();
  }

  private TextBlock createFooterMessage() {
    return TextBlock.builder()
        .type("TextBlock")
        .text(TEMPLATE_FOOTER)
        .size("Small")
        .weight("Lighter")
        .horizontalAlignment("Center")
        .spacing("Medium")
        .separator(true)
        .build();
  }

  private TextBlock createBoldTextBlock(String text) {
    return TextBlock.builder()
        .type("TextBlock")
        .text(applyBoldFormat(text))
        .weight("Bolder")
        .wrap(true)
        .build();
  }

  private TextBlock createDivider() {
    return TextBlock.builder()
        .type("TextBlock")
        .text(" ")
        .separator(true)
        .spacing("Medium")
        .build();
  }

  private TeamsMessage.Fact createFact(String title, String value) {
    return TeamsMessage.Fact.builder().title(applyBoldFormat(title)).value(value).build();
  }

  private String applyBoldFormat(String title) {
    return String.format(getBoldWithSpace(), title);
  }

  private Image createOMImageMessage() {
    return Image.builder().type("Image").url("https://imgur.com/kOOPEG4.png").size("Small").build();
  }
}
