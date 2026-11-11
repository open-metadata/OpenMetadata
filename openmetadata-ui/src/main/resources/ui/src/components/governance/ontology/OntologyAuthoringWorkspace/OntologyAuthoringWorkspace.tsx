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
import { ComponentProps } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import {
  listOntologyConcepts,
  listOntologyProperties,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import OntologyConceptEditor from '../OntologyConceptEditor/OntologyConceptEditor';
import OntologyPropertyEditor from '../OntologyPropertyEditor/OntologyPropertyEditor';
import OntologyConceptCreateDrawer from './OntologyConceptCreateDrawer';
import OntologyDefinitionList from './OntologyDefinitionList';

interface OntologyAuthoringWorkspaceProps {
  ontology: Ontology;
  definitionType?: 'concept' | 'property';
  onWorkingChange?: () => void;
}

const useConceptOptions = (ontology: Ontology) => {
  const { model } = useOntologyStudioModel(ontology);

  return model?.concepts
    .filter(
      (concept) => concept.conceptType !== OntologyConceptType.SkosConcept
    )
    .map((concept) => ({ iri: concept.iri, label: getEntityName(concept) }));
};

const usePropertyOptions = (ontology: Ontology) => {
  const { model } = useOntologyStudioModel(ontology);

  return model?.properties.map((property) => ({
    iri: property.iri,
    label: getEntityName(property),
    kind: property.kind,
  }));
};

const PropertyEditorWithConcepts = (
  props: Omit<
    ComponentProps<typeof OntologyPropertyEditor>,
    'concepts' | 'properties'
  >
) => {
  const concepts = useConceptOptions(props.ontology);
  const properties = usePropertyOptions(props.ontology);

  return (
    <OntologyPropertyEditor
      {...props}
      concepts={concepts}
      properties={properties}
    />
  );
};

const ConceptEditorWithConcepts = (
  props: Omit<ComponentProps<typeof OntologyConceptEditor>, 'concepts'>
) => {
  const concepts = useConceptOptions(props.ontology);

  return <OntologyConceptEditor {...props} concepts={concepts} />;
};

const OntologyAuthoringWorkspace = ({
  ontology,
  definitionType = 'concept',
  onWorkingChange,
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
        ontology={ontology}
        renderCreate={({ close, onCreated }) => (
          <OntologyConceptCreateDrawer
            ontology={ontology}
            onClose={close}
            onCreated={onCreated}
          />
        )}
        onWorkingChange={onWorkingChange}>
        {(concept, canEdit, onSaved) =>
          concept ? (
            <ConceptEditorWithConcepts
              canEdit={canEdit}
              concept={concept}
              ontology={ontology}
              onSaved={onSaved}
            />
          ) : null
        }
      </OntologyDefinitionList>
    );
  }

  return (
    <OntologyDefinitionList
      canCreate={canCreateDefinition}
      definitionType="property"
      key={ontology.id + ':property'}
      load={listOntologyProperties}
      ontology={ontology}
      onWorkingChange={onWorkingChange}>
      {(property, canEdit, onSaved) => (
        <PropertyEditorWithConcepts
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
