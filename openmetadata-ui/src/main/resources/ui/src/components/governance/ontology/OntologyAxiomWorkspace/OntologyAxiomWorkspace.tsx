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
import {
  Badge,
  Button,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle } from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { uniq } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  AxiomType,
  OntologyAxiom,
  Provenance,
} from '../../../../generated/entity/data/ontologyAxiom';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { getOntologyWorkingValidation } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import OntologyDefinitionList, {
  DefinitionColumn,
} from '../OntologyAuthoringWorkspace/OntologyDefinitionList';
import { shortenIris } from '../OntologyAuthoringWorkspace/OntologyDefinitionTable.utils';
import OntologyAxiomEditor from '../OntologyAxiomEditor/OntologyAxiomEditor';
import {
  axiomFormValues,
  axiomTypeLabel,
  previewSentence,
} from '../OntologyAxiomEditor/OntologyAxiomEditor.parts';
import { overviewValidationQueryKey } from '../OntologyOverview/OntologyOverview.constants';

const ALL = 'all';
const PROVENANCE_LABELS: Record<Provenance, string> = {
  [Provenance.Manual]: 'label.manual',
  [Provenance.Imported]: 'label.imported',
  [Provenance.Inferred]: 'label.inferred',
  [Provenance.AISuggested]: 'label.ai-suggested',
};

const ValidationResult = ({ ontologyId }: { ontologyId: string }) => {
  const { t } = useTranslation();
  const validation = useQuery({
    queryKey: overviewValidationQueryKey(ontologyId),
    queryFn: () => getOntologyWorkingValidation(ontologyId),
    retry: false,
  });
  const conflicts = validation.data?.violations.length ?? 0;

  const renderResult = () => {
    if (validation.isError) {
      return (
        <Typography as="span" color="danger" size="text-sm">
          {t('server.unexpected-error')}
        </Typography>
      );
    }
    if (!validation.data) {
      return null;
    }

    return conflicts > 0 ? (
      <Badge color="error" size="sm" type="pill-color">
        {t('label.n-conflicts', { count: conflicts })}
      </Badge>
    ) : (
      <Typography as="span" color="secondary" size="text-sm">
        {t('message.ontology-validate-all-clean')}
      </Typography>
    );
  };

  return (
    <>
      <span data-testid="ontology-constraints-validation">
        {renderResult()}
      </span>
      <Button
        color="secondary"
        data-testid="ontology-constraints-validate"
        iconLeading={CheckCircle}
        isLoading={validation.isFetching}
        size="sm"
        onPress={() => void validation.refetch()}>
        {t('label.validate-all')}
      </Button>
    </>
  );
};

const OntologyAxiomWorkspace = ({
  ontology,
  onWorkingChange,
  onOpenConcept,
}: {
  ontology: Ontology;
  onWorkingChange?: () => void;
  /** Opens the constraint's subject on the graph. */
  onOpenConcept?: (conceptId: string) => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { model, isError, refetch } = useOntologyStudioModel(ontology);
  const [axiomType, setAxiomType] = useState<string>(ALL);
  const [provenance, setProvenance] = useState<string>(ALL);
  const references = useMemo(
    () =>
      model
        ? {
            concepts: model.concepts
              .filter(
                (concept) =>
                  concept.conceptType !== OntologyConceptType.SkosConcept
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
        : undefined,
    [model]
  );
  const conceptIdByIri = useMemo(
    () =>
      new Map(
        (model?.concepts ?? []).map((concept) => [concept.iri, concept.id])
      ),
    [model]
  );
  const items = useMemo(
    () =>
      model?.axioms.filter(
        (axiom) =>
          (axiomType === ALL || axiom.axiomType === axiomType) &&
          (provenance === ALL || axiom.provenance === provenance)
      ),
    [model, axiomType, provenance]
  );
  const { permissions } = usePermissionProvider();
  const { canCreate } = getDerivedPermissionFlags(
    permissions[ResourceEntity.ONTOLOGY_AXIOM] ?? DEFAULT_ENTITY_PERMISSION,
    ontology?.deleted
  );
  // Labels every concept and property, SKOS ones included, which the editor's options leave out.
  const sentenceLabels = useMemo(
    () =>
      model
        ? {
            concepts: model.concepts.map((concept) => ({
              iri: concept.iri,
              label: getEntityName(concept),
            })),
            properties: model.properties.map((property) => ({
              iri: property.iri,
              kind: property.kind,
              label: getEntityName(property),
            })),
          }
        : undefined,
    [model]
  );
  const sentenceOf = (axiom: OntologyAxiom) =>
    shortenIris(previewSentence(axiomFormValues(axiom), t, sentenceLabels));

  const columns: DefinitionColumn<OntologyAxiom>[] = [
    {
      id: 'sentence',
      label: t('label.sentence'),
      render: (axiom) => (
        <Typography
          as="span"
          className="tw:line-clamp-2 tw:min-w-64"
          size="text-sm">
          {sentenceOf(axiom)}
        </Typography>
      ),
    },
    {
      id: 'type',
      label: t('label.type'),
      render: (axiom) => (
        <Typography as="span" className="tw:whitespace-nowrap" size="text-sm">
          {axiomTypeLabel(axiom.axiomType, t)}
        </Typography>
      ),
    },
    {
      id: 'source',
      label: t('label.source'),
      render: (axiom) => (
        <Typography as="span" color="secondary" size="text-sm">
          {t(PROVENANCE_LABELS[axiom.provenance])}
        </Typography>
      ),
    },
    {
      id: 'description',
      label: t('label.description'),
      render: (axiom) => (
        <Typography as="span" className="tw:line-clamp-1" size="text-sm">
          {axiom.description}
        </Typography>
      ),
    },
    {
      id: 'graph',
      label: '',
      render: (axiom) => {
        const conceptId = conceptIdByIri.get(axiom.subjectIri);

        return conceptId && onOpenConcept ? (
          <Button
            className="tw:whitespace-nowrap"
            color="link-color"
            size="sm"
            onPress={() => onOpenConcept(conceptId)}>
            {t('label.show-on-graph')}
          </Button>
        ) : null;
      },
    },
  ];

  const toolbar = (
    <>
      <Select
        aria-label={t('label.type')}
        className="tw:w-48"
        data-testid="ontology-definition-type-filter"
        selectedKey={axiomType}
        size="sm"
        onSelectionChange={(key) => setAxiomType(String(key))}>
        {[
          { id: ALL, label: t('label.all-types') },
          ...uniq(model?.axioms.map((axiom) => axiom.axiomType) ?? []).map(
            (type) => ({
              id: type,
              label: axiomTypeLabel(type as AxiomType, t),
            })
          ),
        ].map((option) => (
          <Select.Item id={option.id} key={option.id} label={option.label} />
        ))}
      </Select>
      <Select
        aria-label={t('label.source')}
        className="tw:w-44"
        data-testid="ontology-definition-source-filter"
        selectedKey={provenance}
        size="sm"
        onSelectionChange={(key) => setProvenance(String(key))}>
        {[
          { id: ALL, label: t('label.any-source') },
          ...Object.values(Provenance).map((value) => ({
            id: value,
            label: t(PROVENANCE_LABELS[value]),
          })),
        ].map((option) => (
          <Select.Item id={option.id} key={option.id} label={option.label} />
        ))}
      </Select>
      <ValidationResult ontologyId={ontology.id} />
    </>
  );

  return (
    <OntologyDefinitionList
      canCreate={canCreate}
      columns={columns}
      definitionType="axiom"
      isError={isError}
      items={items}
      ontology={ontology}
      summary={
        items
          ? t('label.n-of-m', {
              count: items.length,
              total: model?.axioms.length ?? 0,
            })
          : undefined
      }
      toolbar={toolbar}
      onChanged={() => {
        void refetch();
        // A saved or deleted constraint changes the verdict, so the shown result must not stay.
        void queryClient.invalidateQueries({
          queryKey: overviewValidationQueryKey(ontology.id),
        });
        onWorkingChange?.();
      }}
      onRetry={() => void refetch()}>
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
