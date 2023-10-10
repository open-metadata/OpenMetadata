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

import java.util.LinkedList;
import org.apache.commons.lang3.StringUtils;
import org.bitbucket.cowwoc.diffmatchpatch.DiffMatchPatch;
import org.openmetadata.schema.type.ChangeEvent;

public interface MessageDecorator<T> {
  String getBold();

  String getLineBreak();

  String getAddMarker();

  String getAddMarkerClose();

  String getRemoveMarker();

  String getRemoveMarkerClose();

  String getEntityUrl(String entityType, String fqn);

  default String httpAddMarker() {
    return "<!add>";
  }

  default String httpRemoveMarker() {
    return "<!remove>";
  }

  T buildMessage(ChangeEvent event);

  default String getPlaintextDiff(String oldValue, String newValue) {
    // create a configured DiffRowGenerator
    oldValue = oldValue == null ? StringUtils.EMPTY : oldValue;
    String addMarker = this.httpAddMarker();
    String removeMarker = this.httpRemoveMarker();

    DiffMatchPatch dmp = new DiffMatchPatch();
    LinkedList<DiffMatchPatch.Diff> diffs = dmp.diffMain(oldValue, newValue);
    dmp.diffCleanupSemantic(diffs);
    StringBuilder outputStr = new StringBuilder();
    for (DiffMatchPatch.Diff d : diffs) {
      if (DiffMatchPatch.Operation.EQUAL.equals(d.operation)) {
        // merging equal values of both string
        outputStr.append(d.text.trim()).append(" ");
      } else if (DiffMatchPatch.Operation.INSERT.equals(d.operation)) {
        // merging added values with addMarker before and after of new values added
        outputStr.append(addMarker).append(d.text.trim()).append(addMarker).append(" ");
      } else {
        // merging deleted values with removeMarker before and after of old value removed ..
        outputStr.append(removeMarker).append(d.text.trim()).append(removeMarker).append(" ");
      }
    }
    String diff = outputStr.toString().trim();
    // The additions and removals will be wrapped by <!add> and <!remove> tags
    // Replace them with html tags to render nicely in the UI
    // Example: This is a test <!remove>sentence<!remove><!add>line<!add>
    // This is a test <span class="diff-removed">sentence</span><span class="diff-added">line</span>
    diff = this.replaceMarkers(diff, addMarker, this.getAddMarker(), this.getAddMarkerClose());
    diff = this.replaceMarkers(diff, removeMarker, this.getRemoveMarker(), this.getRemoveMarkerClose());
    return diff;
  }

  default String replaceMarkers(String diff, String marker, String openTag, String closeTag) {
    int index = 0;
    while (diff.contains(marker)) {
      String replacement = index % 2 == 0 ? openTag : closeTag;
      diff = diff.replaceFirst(marker, replacement);
      index++;
    }
    return diff;
  }
}
