/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;

class OntologyEditLockResourceTest {
  @Test
  void glossaryLeasesUseTheGlossaryEditorPermission() {
    assertEquals(
        MetadataOperation.EDIT_GLOSSARY_TERMS,
        OntologyEditLockResource.editOperation(Entity.GLOSSARY));
    assertEquals(
        MetadataOperation.EDIT_GLOSSARY_TERMS,
        OntologyEditLockResource.editOperation(Entity.GLOSSARY_TERM));
  }

  @Test
  void otherLeaseResourcesRequireEditAll() {
    assertEquals(
        MetadataOperation.EDIT_ALL,
        OntologyEditLockResource.editOperation(Entity.ONTOLOGY_CHANGE_SET));
  }
}
