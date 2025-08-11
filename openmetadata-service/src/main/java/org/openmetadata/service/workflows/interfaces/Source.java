/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.workflows.interfaces;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ListFilter;

public interface Source<R> extends Stats {
  R readNext(Map<String, Object> contextData) throws SearchIndexException;

  R readWithCursor(String currentCursor) throws SearchIndexException;

  List<String> getReaderErrors();

  void reset();

  String getEntityType();

  int getBatchSize();

  String getLastFailedCursor();

  default List<String> getFields() {
    return new ArrayList<>();
  }

  ListFilter getFilter();

  AtomicReference<Boolean> isDone();

  AtomicReference<String> getCursor();
}
