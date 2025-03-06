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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatMessage.*;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.util.email.EmailUtil;

public class GChatMessageDecorator implements MessageDecorator<GChatMessage> {

  @Override
  public String getBold() {
    return "<b>%s</b>";
  }

  @Override
  public String getBoldWithSpace() {
    return "<b>%s</b> ";
  }

  @Override
  public String getLineBreak() {
    return " <br/> ";
  }

  @Override
  public String getAddMarker() {
    return "<b>";
  }

  @Override
  public String getAddMarkerClose() {
    return "</b>";
  }

  @Override
  public String getRemoveMarker() {
    return "<s>";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</s>";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalParams) {
    String encodedFqn = encodeEntityFqn(fqn);
    return String.format(
        "<%s/%s/%s%s|%s>",
        EmailUtil.getOMBaseURL(),
        prefix,
        encodedFqn,
        nullOrEmpty(additionalParams) ? "" : String.format("/%s", additionalParams),
        fqn.trim());
  }

  @Override
  public GChatMessage buildEntityMessage(String publisherName, ChangeEvent event) {
    return createMessage(publisherName, event, createEntityMessage(publisherName, event));
  }

  @Override
  public GChatMessage buildThreadMessage(String publisherName, ChangeEvent event) {
    return createMessage(publisherName, event, createThreadMessage(publisherName, event));
  }

  @Override
  public GChatMessage buildTestMessage() {
    return getGChatTestMessage();
  }

  private GChatMessage getGChatTestMessage() {
    return createConnectionTestMessage();
  }

  public GChatMessage createMessage(
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

  private GChatMessage createTestCaseMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {
    final String testCaseResult = "testCaseResult";

    List<FieldChange> fieldsAdded = event.getChangeDescription().getFieldsAdded();
    List<FieldChange> fieldsUpdated = event.getChangeDescription().getFieldsUpdated();

    boolean hasRelevantChange =
        fieldsAdded.stream().anyMatch(field -> testCaseResult.equals(field.getName()))
            || fieldsUpdated.stream().anyMatch(field -> testCaseResult.equals(field.getName()));

    return hasRelevantChange
        ? createDQTemplate(publisherName, event, outgoingMessage)
        : createGeneralChangeEventMessage(publisherName, event, outgoingMessage);
  }

  public GChatMessage createGeneralChangeEventMessage(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    Map<General_Template_Section, Map<Enum<?>, Object>> data =
        buildGeneralTemplateData(publisherName, event, outgoingMessage);

    Map<Enum<?>, Object> eventDetails = data.get(General_Template_Section.EVENT_DETAILS);

    Header header = createHeader();

    List<Widget> additionalMessageWidgets =
        outgoingMessage.getMessages().stream()
            .map(message -> new Widget(new TextParagraph(message)))
            .toList();

    Section detailsSection = new Section(createEventDetailsWidgets(eventDetails));
    Section messageSection = new Section(additionalMessageWidgets);
    Section fqnSection =
        new Section(
            List.of(
                createWidget(
                    "FQN:",
                    String.valueOf(eventDetails.getOrDefault(EventDetailsKeys.ENTITY_FQN, "-")))));

    // todo create clickable entity link in the message

    Section footerSection = createFooterSection();

    Card card =
        new Card(header, List.of(detailsSection, fqnSection, messageSection, footerSection));
    return new GChatMessage(List.of(card));
  }

  private Map<General_Template_Section, Map<Enum<?>, Object>> buildGeneralTemplateData(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    TemplateDataBuilder<General_Template_Section> builder = new TemplateDataBuilder<>();
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

  public GChatMessage createConnectionTestMessage() {
    Header header = createConnectionSuccessfulHeader();

    Widget descriptionWidget = new Widget(new TextParagraph(CONNECTION_TEST_DESCRIPTION));

    Section descriptionSection = new Section(List.of(descriptionWidget));
    Section footerSection = createFooterSection();

    Card card = new Card(header, Arrays.asList(descriptionSection, footerSection));

    return new GChatMessage(List.of(card));
  }

  public GChatMessage createDQTemplate(
      String publisherName, ChangeEvent event, OutgoingMessage outgoingMessage) {

    Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData =
        MessageDecorator.buildDQTemplateData(event, outgoingMessage);

    List<Section> sections = new ArrayList<>();
    Header header = createHeader();

    addChangeEventDetailsSection(templateData, sections);

    List<Widget> additionalMessageWidgets =
        outgoingMessage.getMessages().stream()
            .map(message -> new Widget(new TextParagraph(message)))
            .toList();
    sections.add(new Section(additionalMessageWidgets));

    // todo create clickable entity link in the message

    addTestCaseDetailsSection(templateData, sections);
    addTestCaseFQNSection(templateData, sections);
    addTestCaseResultSection(templateData, sections);
    addParameterValuesSection(templateData, sections);
    addInspectionQuerySection(templateData, sections);
    addTestDefinitionSection(templateData, sections);
    addSampleDataSection(templateData, sections);

    sections.add(createFooterSection());

    // Create the card with all sections
    Card card = new Card(header, sections);
    return new GChatMessage(List.of(card));
  }

  private void addChangeEventDetailsSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> eventDetails = templateData.get(DQ_Template_Section.EVENT_DETAILS);
    if (nullOrEmpty(eventDetails)) {
      return;
    }

    sections.add(new Section(createEventDetailsWidgets(eventDetails)));
  }

  private void addTestCaseDetailsSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return;
    }

    List<Widget> testCaseDetailsWidgets =
        List.of(
            createWidget("TEST CASE"),
            createWidget(
                "ID:",
                String.valueOf(testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.ID, "-"))),
            createWidget(
                "Name:",
                String.valueOf(testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.NAME, "-"))),
            createWidget("Owners:", formatOwners(testCaseDetails)),
            createWidget("Tags:", formatTags(testCaseDetails)));

    sections.add(new Section(testCaseDetailsWidgets));
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

  private void addTestCaseFQNSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);
    if (nullOrEmpty(testCaseDetails)) {
      return;
    }

    Widget testCaseFQNWidget =
        createWidget(
            "Test Case FQN:",
            String.valueOf(
                testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.TEST_CASE_FQN, "-")));

    sections.add(new Section(List.of(testCaseFQNWidget)));
  }

  private void addTestCaseResultSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> testCaseResult = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);
    if (nullOrEmpty(testCaseResult)) {
      return;
    }

    List<Widget> statusParameterWidgets = new ArrayList<>();
    statusParameterWidgets.add(createWidget("TEST CASE RESULT"));

    statusParameterWidgets.add(
        createWidget(
            "Status:", getStatusWithEmoji(testCaseResult.get(DQ_TestCaseResultKeys.STATUS))));

    statusParameterWidgets.add(
        createWidget(
            "Result Message:",
            String.valueOf(
                testCaseResult.getOrDefault(DQ_TestCaseResultKeys.RESULT_MESSAGE, "-"))));

    sections.add(new Section(statusParameterWidgets));
  }

  private String getStatusWithEmoji(Object object) {
    if (object instanceof TestCaseStatus status) {
      return switch (status) {
        case Success -> "Success \u2705"; // Green checkmark for success
        case Failed -> "Failed \u274C"; // Red cross for failure
        case Aborted -> "Aborted \u26A0"; // Warning sign for aborted
        case Queued -> "Queued \u23F3"; // Hourglass for queued
        default -> "Unknown \u2753"; // Gray question mark for unknown cases
      };
    }
    return "Unknown \u2753"; // Default to unknown if the object is not a valid TestCaseStatus
  }

  private void addParameterValuesSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> testCaseResult = templateData.get(DQ_Template_Section.TEST_CASE_RESULT);
    if (nullOrEmpty(testCaseResult)) {
      return;
    }

    Object result = testCaseResult.get(DQ_TestCaseResultKeys.PARAMETER_VALUE);
    if (!(result instanceof List<?>)) {
      return;
    }

    List<TestCaseParameterValue> parameterValues = (List<TestCaseParameterValue>) result;
    if (nullOrEmpty(parameterValues)) {
      return;
    }

    String parameterValuesText =
        parameterValues.stream()
            .map(param -> String.format("[%s: %s]", param.getName(), param.getValue()))
            .collect(Collectors.joining(", "));

    List<Widget> parameterValueWidget = new ArrayList<>();
    parameterValueWidget.add(createWidget("Parameter Value:", parameterValuesText));

    sections.add(new Section(parameterValueWidget));
  }

  private void addInspectionQuerySection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> testCaseDetails = templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);

    if (!nullOrEmpty(testCaseDetails)) {
      String inspectionQueryText =
          String.valueOf(
              testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.INSPECTION_QUERY, "-"));

      Widget inspectionQuery = createWidget("Inspection Query", "");
      Widget inspectionQueryWidget = new Widget(new TextParagraph(inspectionQueryText));

      sections.add(new Section(List.of(inspectionQuery, inspectionQueryWidget)));
    }
  }

  private void addTestDefinitionSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {

    Map<Enum<?>, Object> testDefinition = templateData.get(DQ_Template_Section.TEST_DEFINITION);

    if (!nullOrEmpty(testDefinition)) {
      List<Widget> testDefinitionWidgets =
          List.of(
              createWidget("TEST DEFINITION"),
              createWidget(
                  "Name:",
                  String.valueOf(
                      testDefinition.getOrDefault(
                          DQ_TestDefinitionKeys.TEST_DEFINITION_NAME, "-"))),
              createWidget(
                  "Description:",
                  String.valueOf(
                      testDefinition.getOrDefault(
                          DQ_TestDefinitionKeys.TEST_DEFINITION_DESCRIPTION, "-"))));

      sections.add(new Section(testDefinitionWidgets));
    }
  }

  private void addSampleDataSection(
      Map<DQ_Template_Section, Map<Enum<?>, Object>> templateData, List<Section> sections) {
    if (templateData.containsKey(DQ_Template_Section.TEST_CASE_DETAILS)) {
      Map<Enum<?>, Object> testCaseDetails =
          templateData.get(DQ_Template_Section.TEST_CASE_DETAILS);

      if (!nullOrEmpty(testCaseDetails)) {
        Widget sampleDataWidget =
            createWidget(
                "Sample Data:",
                String.valueOf(
                    testCaseDetails.getOrDefault(DQ_TestCaseDetailsKeys.SAMPLE_DATA, "-")));

        sections.add(new Section(List.of(sampleDataWidget)));
      }
    }
  }

  private List<Widget> createEventDetailsWidgets(Map<Enum<?>, Object> detailsMap) {
    List<Widget> widgets = new ArrayList<>();

    Map<Enum<?>, String> labelsMap = new LinkedHashMap<>();
    labelsMap.put(EventDetailsKeys.EVENT_TYPE, "Event Type:");
    labelsMap.put(EventDetailsKeys.UPDATED_BY, "Updated By:");
    labelsMap.put(EventDetailsKeys.ENTITY_TYPE, "Entity Type:");
    labelsMap.put(EventDetailsKeys.TIME, "Time:");

    labelsMap.forEach(
        (key, label) -> {
          if (detailsMap.containsKey(key)) {
            widgets.add(createWidget(label, String.valueOf(detailsMap.get(key))));
          }
        });

    return widgets;
  }

  private Widget createWidget(String label) {
    return new Widget(new TextParagraph(applyBoldFormatWithSpace(label) + StringUtils.EMPTY));
  }

  private Widget createWidget(String label, String content) {
    return new Widget(new TextParagraph(applyBoldFormatWithSpace(label) + content));
  }

  private Header createHeader() {
    return new Header("Change Event Details", "https://imgur.com/kOOPEG4.png", "IMAGE");
  }

  private Header createConnectionSuccessfulHeader() {
    return new Header("Connection Successful \u2705", "https://imgur.com/kOOPEG4.png", "IMAGE");
  }

  private Section createFooterSection() {
    return new Section(List.of(new Widget(new TextParagraph(TEMPLATE_FOOTER))));
  }

  private String applyBoldFormatWithSpace(String title) {
    return String.format(getBoldWithSpace(), title);
  }
}
