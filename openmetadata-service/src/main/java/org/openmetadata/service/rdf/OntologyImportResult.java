/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/** Summary of an OWL/RDF ontology import into OpenMetadata glossaries. */
@Getter
@Setter
public class OntologyImportResult {
  private boolean dryRun;
  private int glossariesCreated;
  private int termsCreated;
  private int termsUpdated;
  private int relationsAdded;
  private int conceptMappingsAdded;
  private int relationTypesRegistered;
  private int customPropertiesCreated;
  private final List<String> messages = new ArrayList<>();

  public void addMessage(String message) {
    messages.add(message);
  }
}
