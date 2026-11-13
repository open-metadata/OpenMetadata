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
import { useEffect } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyNewClassPanel, {
  OntologyFieldProps,
} from '../OntologyNewClassPanel/OntologyNewClassPanel';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';

interface Props {
  ontology: Ontology;
  ontologyField?: OntologyFieldProps;
  onClose: () => void;
  onCreated: (concept?: OntologyConcept) => void;
}

/** The Term tab opens the same drawer as the graph, so both validate and save alike. */
const OntologyConceptCreateDrawer = ({
  ontology,
  ontologyField,
  onClose,
  onCreated,
}: Props) => {
  const { permissions } = usePermissionProvider();
  const { model, refetch } = useOntologyStudioModel(ontology);
  const flagsOf = (resource: ResourceEntity) =>
    getDerivedPermissionFlags(
      permissions[resource] ?? DEFAULT_ENTITY_PERMISSION,
      ontology.deleted
    );
  const { canEditAll: canEditOntology } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology.id },
    { deleted: ontology.deleted }
  );
  useEffect(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]);

  if (!model) {
    return (
      <OntologyStudioDrawer testId="ontology-concept-create-loading">
        <Loader />
      </OntologyStudioDrawer>
    );
  }

  return (
    <OntologyNewClassPanel
      canCreate={[
        flagsOf(ResourceEntity.ONTOLOGY_CONCEPT).canCreate,
        flagsOf(ResourceEntity.ONTOLOGY_CHANGE_SET).canCreate,
        canEditOntology,
      ].every(Boolean)}
      canCreateAxiom={flagsOf(ResourceEntity.ONTOLOGY_AXIOM).canCreate}
      canCreateProperty={flagsOf(ResourceEntity.ONTOLOGY_PROPERTY).canCreate}
      model={model}
      ontology={ontology}
      ontologyField={ontologyField}
      onBeforeCreate={() => undefined}
      onClose={onClose}
      onCreated={async (iri, { keepOpen }) => {
        const refreshed = await refetch();
        const created = refreshed.data?.concepts.find((c) => c.iri === iri);
        if (!created) {
          return false;
        }
        onCreated(keepOpen ? undefined : created);

        return true;
      }}
      onUndone={() => {
        void refetch();
        onCreated(undefined);
      }}
    />
  );
};

export default OntologyConceptCreateDrawer;
