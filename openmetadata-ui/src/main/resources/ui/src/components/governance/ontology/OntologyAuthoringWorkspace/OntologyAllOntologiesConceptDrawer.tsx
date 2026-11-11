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
import { useMemo, useRef, useState } from 'react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { CarriedConceptDraft } from '../OntologyNewClassPanel/OntologyNewClassPanel';
import OntologyConceptCreateDrawer from './OntologyConceptCreateDrawer';

export const LAST_CONCEPT_ONTOLOGY_KEY =
  'ontology-studio-last-concept-ontology';

const readLastOntology = () => {
  try {
    return localStorage.getItem(LAST_CONCEPT_ONTOLOGY_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const rememberOntology = (id: string) => {
  try {
    localStorage.setItem(LAST_CONCEPT_ONTOLOGY_KEY, id);
  } catch {
    // The preselection is a convenience; without storage the first ontology is used.
  }
};

interface Props {
  ontologies: Ontology[];
  onClose: () => void;
  /** `done` is false for add-another and undo, which leave the drawer open. */
  onCreated: (ontology: Ontology, done: boolean) => void;
}

/** Add concept from All ontologies: the same drawer, with a required Ontology field first. */
const OntologyAllOntologiesConceptDrawer = ({
  ontologies,
  onClose,
  onCreated,
}: Props) => {
  const [chosenId, setChosenId] = useState(readLastOntology);
  const draft = useRef<CarriedConceptDraft>();
  const ontology =
    ontologies.find((item) => item.id === chosenId) ?? ontologies[0];
  const options = useMemo(
    () =>
      ontologies.map((item) => ({ id: item.id, label: getEntityName(item) })),
    [ontologies]
  );

  if (!ontology) {
    return null;
  }

  return (
    <OntologyConceptCreateDrawer
      key={ontology.id}
      ontology={ontology}
      ontologyField={{
        options,
        value: ontology.id,
        draft,
        onChange: (id) => {
          rememberOntology(id);
          setChosenId(id);
        },
      }}
      onClose={onClose}
      onCreated={(concept?: OntologyConcept) => {
        rememberOntology(ontology.id);
        onCreated(ontology, Boolean(concept));
      }}
    />
  );
};

export default OntologyAllOntologiesConceptDrawer;
