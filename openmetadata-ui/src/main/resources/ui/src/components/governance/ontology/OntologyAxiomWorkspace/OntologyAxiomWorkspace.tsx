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
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { listOntologyAxioms } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import OntologyDefinitionList from '../OntologyAuthoringWorkspace/OntologyDefinitionList';
import OntologyAxiomEditor from '../OntologyAxiomEditor/OntologyAxiomEditor';

const OntologyAxiomWorkspace = ({
  ontology,
  onWorkingChange,
}: {
  ontology: Ontology;
  onWorkingChange?: () => void;
}) => {
  const { model } = useOntologyStudioModel(ontology);
  const references = model
    ? {
        concepts: model.concepts
          .filter(
            (concept) => concept.conceptType !== OntologyConceptType.SkosConcept
          )
          .map((concept) => ({
            iri: concept.iri,
            label: getEntityName(concept),
          })),
        properties: model.properties
          .filter((property) => property.kind !== Kind.Annotation)
          .map((property) => ({
            iri: property.iri,
            kind: property.kind,
            label: getEntityName(property),
          })),
      }
    : undefined;
  const { permissions } = usePermissionProvider();
  const { canCreate } = getDerivedPermissionFlags(
    permissions[ResourceEntity.ONTOLOGY_AXIOM] ?? DEFAULT_ENTITY_PERMISSION,
    ontology?.deleted
  );

  return (
    <OntologyDefinitionList
      canCreate={canCreate}
      definitionType="axiom"
      load={(params, signal) => listOntologyAxioms(ontology.id, params, signal)}
      ontology={ontology}
      onWorkingChange={onWorkingChange}>
      {(axiom, canEdit, onSaved) => (
        <OntologyAxiomEditor
          axiom={axiom}
          canEdit={canEdit}
          ontology={ontology}
          references={references}
          onSaved={onSaved}
        />
      )}
    </OntologyDefinitionList>
  );
};

export default OntologyAxiomWorkspace;
