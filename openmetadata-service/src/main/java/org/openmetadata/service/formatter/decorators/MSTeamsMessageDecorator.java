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

import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.util.EmailUtil.getSmtpSettings;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.util.FeedUtils;

public class MSTeamsMessageDecorator implements MessageDecorator<TeamsMessage> {

  @Override
  public String getBold() {
    return "**%s**";
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
  public String getEntityUrl(String entityType, String fqn) {
    return String.format(
        "[%s](/%s/%s)", fqn.trim(), getSmtpSettings().getOpenMetadataUrl(), entityType);
  }

  @Override
  public TeamsMessage buildEntityMessage(ChangeEvent event) {
    TeamsMessage teamsMessage = new TeamsMessage();
    teamsMessage.setSummary("Change Event From OMD");
    TeamsMessage.Section teamsSections = new TeamsMessage.Section();
    EntityInterface entityInterface = getEntity(event);
    if (event.getEntity() != null) {
      String headerTxt = "%s posted on " + event.getEntityType() + " %s";
      String headerText =
          String.format(
              headerTxt,
              event.getUserName(),
              this.buildEntityUrl(event.getEntityType(), entityInterface));
      teamsSections.setActivityTitle(headerText);
    }
    List<Thread> thread = FeedUtils.getThreadWithMessage(event, "admin");
    List<TeamsMessage.Section> attachmentList = new ArrayList<>();
    for (Thread entry : thread) {
      attachmentList.add(getTeamsSection(teamsSections.getActivityTitle(), entry.getMessage()));
    }
    teamsMessage.setSections(attachmentList);
    return teamsMessage;
  }

  @Override
  public TeamsMessage buildThreadMessage(ChangeEvent event) {
    OutgoingMessage outgoingMessage = createThreadMessage(event);

    if (!outgoingMessage.getMessages().isEmpty()) {
      TeamsMessage teamsMessage = new TeamsMessage();
      teamsMessage.setSummary("Change Event From OpenMetadata");

      // Sections
      TeamsMessage.Section teamsSections = new TeamsMessage.Section();
      teamsSections.setActivityTitle(outgoingMessage.getHeader());
      List<TeamsMessage.Section> attachmentList = new ArrayList<>();
      outgoingMessage
          .getMessages()
          .forEach(m -> attachmentList.add(getTeamsSection(teamsSections.getActivityTitle(), m)));

      teamsMessage.setSections(attachmentList);
      return teamsMessage;
    }
    throw new UnhandledServerException("No messages found for the event");
  }

  private TeamsMessage.Section getTeamsSection(String activityTitle, String message) {
    TeamsMessage.Section section = new TeamsMessage.Section();
    section.setActivityTitle(activityTitle);
    section.setActivityText(message);
    return section;
  }
}
