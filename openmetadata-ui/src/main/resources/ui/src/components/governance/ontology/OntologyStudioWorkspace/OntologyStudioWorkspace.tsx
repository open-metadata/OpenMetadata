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
import { Box, Tabs } from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import OntologyMemoryReviewPanel from '../../../OntologyExplorer/OntologyMemoryReviewPanel';
import OntologyStudioQueryConsole from '../../../OntologyExplorer/OntologyStudioQueryConsole';
import OntologyAuthoringWorkspace from '../OntologyAuthoringWorkspace/OntologyAuthoringWorkspace';
import OntologyAxiomWorkspace from '../OntologyAxiomWorkspace/OntologyAxiomWorkspace';
import OntologyCreateForm from '../OntologyCreateForm/OntologyCreateForm';
import OntologyGraphView from '../OntologyGraphView/OntologyGraphView';
import OntologyPublicationWorkspace from '../OntologyPublicationWorkspace/OntologyPublicationWorkspace';

interface OntologyStudioWorkspaceProps {
  ontology?: Ontology;
  canCreate: boolean;
  initialDraftId?: string;
  onSaved: (ontology: Ontology) => void;
}

const OntologyStudioWorkspace = ({
  ontology,
  canCreate,
  initialDraftId,
  onSaved,
}: OntologyStudioWorkspaceProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [surface, setSurface] = useState(initialDraftId ? 'review' : 'graph');
  const [definition, setDefinition] = useState('concept');
  const [revision, setRevision] = useState(0);
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology?.id ?? '' },
    { enabled: Boolean(ontology), deleted: ontology?.deleted }
  );

  if (!ontology) {
    return (
      <Box className="tw:overflow-auto tw:p-6" direction="col">
        <OntologyCreateForm
          canCreate={canCreate}
          currentUserId={currentUser?.id}
          onSaved={onSaved}
        />
      </Box>
    );
  }

  const renderModel = () => (
    <>
      <Tabs
        selectedKey={definition}
        onSelectionChange={(key) => setDefinition(String(key))}>
        <Tabs.List size="sm" type="button-border">
          {['ontology', 'concept', 'property', 'axiom'].map((id) => (
            <Tabs.Item data-testid={`ontology-model-${id}`} id={id} key={id}>
              {t(`label.${id === 'axiom' ? 'constraint-plural' : id}`)}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
      {definition === 'ontology' && (
        <OntologyCreateForm
          canCreate={canEditAll}
          key={ontology.version}
          ontology={ontology}
          onSaved={onSaved}
        />
      )}
      {(definition === 'concept' || definition === 'property') && (
        <OntologyAuthoringWorkspace
          definitionType={definition}
          key={definition}
          ontology={ontology}
        />
      )}
      {definition === 'axiom' && <OntologyAxiomWorkspace ontology={ontology} />}
    </>
  );
  const renderContent = () => {
    switch (surface) {
      case 'graph':
        return <OntologyGraphView key={revision} ontology={ontology} />;
      case 'releases':
        return <OntologyPublicationWorkspace ontology={ontology} />;
      case 'query':
        return (
          <OntologyStudioQueryConsole
            graphData={null}
            relationTypes={[]}
            selectedGlossaryIds={[]}
            selectedOntologyId={ontology.id}
          />
        );
      case 'review':
        return (
          <OntologyMemoryReviewPanel
            canApply={canEditAll}
            canDiscard={canEditAll}
            canSubmit={canEditAll}
            initialDraftId={initialDraftId}
            ontologyId={ontology.id}
            onApplied={() => setRevision((value) => value + 1)}
          />
        );
      default:
        return renderModel();
    }
  };

  return (
    <Box className="tw:min-h-0 tw:flex-1" direction="col">
      <Tabs
        selectedKey={surface}
        onSelectionChange={(key) => setSurface(String(key))}>
        <Tabs.List size="sm" type="underline">
          {Object.entries({
            graph: 'graph',
            model: 'model',
            releases: 'ontology-release',
            review: 'needs-review',
            query: 'query',
          }).map(([id, label]) => (
            <Tabs.Item data-testid={`mode-tab-${id}`} id={id} key={id}>
              {t(`label.${label}`)}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-6"
        direction="col"
        gap={4}>
        {renderContent()}
      </Box>
    </Box>
  );
};

export default OntologyStudioWorkspace;
