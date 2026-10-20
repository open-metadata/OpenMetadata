/*
 *  Copyright 2026 Collate.
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
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  listOntologyConcepts,
  listOntologyProperties,
} from '../../../../rest/ontologyAPI';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import OntologyConceptEditor from '../OntologyConceptEditor/OntologyConceptEditor';
import OntologyPropertyEditor from '../OntologyPropertyEditor/OntologyPropertyEditor';
import OntologyDefinitionList from './OntologyDefinitionList';

interface OntologyAuthoringWorkspaceProps {
  ontology: Ontology;
  definitionType?: 'concept' | 'property';
}

const OntologyAuthoringWorkspace = ({
  ontology,
  definitionType = 'concept',
}: OntologyAuthoringWorkspaceProps) => {
  const { permissions } = usePermissionProvider();
  const { canCreate: canCreateDefinition } = getDerivedPermissionFlags(
    permissions[
      definitionType === 'concept'
        ? ResourceEntity.ONTOLOGY_CONCEPT
        : ResourceEntity.ONTOLOGY_PROPERTY
    ] ?? DEFAULT_ENTITY_PERMISSION,
    ontology?.deleted
  );

  if (definitionType === 'concept') {
    return (
      <OntologyDefinitionList
        canCreate={canCreateDefinition}
        definitionType="concept"
        key={ontology.id + ':concept'}
        load={listOntologyConcepts}
        ontology={ontology}>
        {(concept, canEdit, onSaved) => (
          <OntologyConceptEditor
            canEdit={canEdit}
            concept={concept}
            ontology={ontology}
            onSaved={onSaved}
          />
        )}
      </OntologyDefinitionList>
    );
  }

  return (
    <OntologyDefinitionList
      canCreate={canCreateDefinition}
      definitionType="property"
      key={ontology.id + ':property'}
      load={listOntologyProperties}
      ontology={ontology}>
      {(property, canEdit, onSaved) => (
        <OntologyPropertyEditor
          canEdit={canEdit}
          ontology={ontology}
          property={property}
          onSaved={onSaved}
        />
      )}
    </OntologyDefinitionList>
  );
};

export default OntologyAuthoringWorkspace;
