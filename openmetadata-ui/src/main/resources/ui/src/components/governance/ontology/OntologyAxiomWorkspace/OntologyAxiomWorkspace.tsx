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
  Box,
  Button,
  ButtonUtility,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TFunction } from 'i18next';
import { uniq } from 'lodash';
import { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Code } from '../../../../generated/api/data/ontologyProfileReport';
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
import { makeReadableViolationMessage } from '../../../OntologyExplorer/utils/conflictHighlight';
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
import {
  AxiomConflict,
  axiomStatus,
  AxiomStatus,
  AXIOM_STATUSES,
  AXIOM_STATUS_LABELS,
  constraintCheckTime,
  findAxiomConflicts,
} from './OntologyAxiomWorkspace.utils';

const ALL = 'all';
const EMPTY = '—';
const PROVENANCE_LABELS: Record<Provenance, string> = {
  [Provenance.Manual]: 'label.created-by-user',
  [Provenance.Imported]: 'label.imported-from-rdf',
  [Provenance.Inferred]: 'label.inferred',
  [Provenance.AISuggested]: 'label.ai-suggested',
};

const FilterSelect = ({
  label,
  options,
  testId,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  testId: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <Select
    aria-label={label}
    className="tw:w-44"
    data-testid={testId}
    selectedKey={value}
    size="sm"
    onSelectionChange={(key) => onChange(String(key))}>
    {options.map((option) => (
      <Select.Item id={option.id} key={option.id} label={option.label} />
    ))}
  </Select>
);

const ConflictsChip = ({
  count,
  isOn,
  onToggle,
}: {
  count: number;
  isOn: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Button
      aria-pressed={isOn}
      color={isOn ? 'secondary-destructive' : 'secondary'}
      data-testid="ontology-constraints-conflicts-filter"
      size="sm"
      onPress={onToggle}>
      <span
        aria-hidden
        className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-error-secondary"
      />
      {t('label.conflicts-count', { count })}
    </Button>
  );
};

const ConflictDetail = ({
  axiom,
  conflict,
  explanation,
  onOpenAxiom,
  onOpenConcept,
  conceptIdOf,
}: {
  axiom: OntologyAxiom;
  conflict: AxiomConflict;
  explanation: string;
  onOpenAxiom: (axiom: OntologyAxiom) => void;
  onOpenConcept?: (conceptId: string) => void;
  conceptIdOf: (axiom: OntologyAxiom) => string | undefined;
}) => {
  const { t } = useTranslation();
  const rule = [axiom, conflict.partner].find(
    (item) => item?.axiomType === AxiomType.DisjointWith
  );
  const relationship = [axiom, conflict.partner].find(
    (item) => item && item.axiomType !== AxiomType.DisjointWith
  );
  const relationshipConcept = relationship && conceptIdOf(relationship);

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-error_subtle tw:px-4 tw:py-3"
      data-testid="ontology-constraint-conflict-detail">
      <Typography color="danger" size="text-sm">
        {explanation}
      </Typography>
      <Box gap={4}>
        {relationshipConcept && onOpenConcept ? (
          <Button
            color="link-destructive"
            size="sm"
            onPress={() => onOpenConcept(relationshipConcept)}>
            {t('label.open-the-relationship')}
          </Button>
        ) : null}
        {rule ? (
          <Button
            color="link-destructive"
            size="sm"
            onPress={() => onOpenAxiom(rule)}>
            {t('label.open-the-rule')}
          </Button>
        ) : null}
      </Box>
    </div>
  );
};

const StatusText = ({ status }: { status: AxiomStatus }) => {
  const { t } = useTranslation();

  return (
    <Typography
      ellipsis
      as="span"
      color={status === 'conflict' ? 'danger' : 'secondary'}
      data-testid="ontology-constraint-status"
      size="text-sm"
      weight={status === 'conflict' ? 'medium' : undefined}>
      {t(AXIOM_STATUS_LABELS[status])}
    </Typography>
  );
};

const ValidationError = ({ isError }: { isError: boolean }) => {
  const { t } = useTranslation();

  return isError ? (
    <Typography
      as="span"
      color="danger"
      data-testid="ontology-constraints-validation"
      size="text-sm">
      {t('server.unexpected-error')}
    </Typography>
  ) : null;
};

const filterOptions = (
  t: TFunction,
  axioms: readonly OntologyAxiom[]
): Record<'type' | 'status' | 'source', { id: string; label: string }[]> => ({
  type: [
    { id: ALL, label: t('label.all-types') },
    ...uniq(axioms.map((axiom) => axiom.axiomType)).map((type) => ({
      id: type,
      label: axiomTypeLabel(type, t),
    })),
  ],
  status: [
    { id: ALL, label: t('label.any-status') },
    ...AXIOM_STATUSES.map((status) => ({
      id: status,
      label: t(AXIOM_STATUS_LABELS[status]),
    })),
  ],
  source: [
    { id: ALL, label: t('label.any-source') },
    ...Object.values(Provenance).map((value) => ({
      id: value,
      label: t(PROVENANCE_LABELS[value]),
    })),
  ],
});

const matches = (filter: string, value: string) =>
  filter === ALL || filter === value;

const OntologyAxiomWorkspace = ({
  ontology,
  initialStatus,
  onWorkingChange,
  onOpenConcept,
}: {
  ontology: Ontology;
  /** Opens the tab already filtered, e.g. to conflicts from the Overview. */
  initialStatus?: AxiomStatus;
  onWorkingChange?: () => void;
  /** Opens the constraint's subject on the graph. */
  onOpenConcept?: (conceptId: string) => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { model, isError, refetch } = useOntologyStudioModel(ontology);
  const validation = useQuery({
    queryKey: overviewValidationQueryKey(ontology.id),
    queryFn: () => getOntologyWorkingValidation(ontology.id),
    retry: false,
  });
  const [axiomType, setAxiomType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(initialStatus ?? ALL);
  const [provenance, setProvenance] = useState<string>(ALL);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
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
  const readableMessage = useMemo(
    () =>
      makeReadableViolationMessage(
        (model?.concepts ?? []).map((concept) => ({
          name: concept.name,
          iri: concept.iri,
          label: getEntityName(concept),
        }))
      ),
    [model?.concepts]
  );
  const conceptIdByIri = useMemo(
    () =>
      new Map(
        (model?.concepts ?? []).map((concept) => [concept.iri, concept.id])
      ),
    [model]
  );
  const conflicts = useMemo(
    () =>
      findAxiomConflicts(
        model?.axioms ?? [],
        model?.concepts ?? [],
        validation.data?.violations ?? []
      ),
    [model, validation.data]
  );
  const checkedAt = constraintCheckTime(
    conflicts,
    validation.data?.violations ?? [],
    validation.data ? validation.dataUpdatedAt : undefined
  );
  const statusOf = (axiom: OntologyAxiom) =>
    axiomStatus(axiom, conflicts, checkedAt);
  const items = model?.axioms.filter(
    (axiom) =>
      matches(axiomType, axiom.axiomType) &&
      matches(status, statusOf(axiom)) &&
      matches(provenance, axiom.provenance)
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
  const labelOf = (iri = '') =>
    sentenceLabels?.concepts.find((concept) => concept.iri === iri)?.label ??
    sentenceLabels?.properties.find((property) => property.iri === iri)
      ?.label ??
    iri;
  // A fact reads as the relationship it states: "Medication Record → broader → Clinical Record".
  const sentenceOf = (axiom: OntologyAxiom) =>
    shortenIris(
      axiom.axiomType === AxiomType.ObjectPropertyAssertion
        ? [axiom.subjectIri, axiom.propertyIri, axiom.targetIri]
            .map(labelOf)
            .join(' → ')
        : previewSentence(axiomFormValues(axiom), t, sentenceLabels)
    );
  const conceptIdOf = (axiom: OntologyAxiom) =>
    conceptIdByIri.get(axiom.subjectIri);
  const explain = ({ partner, violation }: AxiomConflict) => {
    if (partner && violation.code === Code.DisjointClash) {
      return t('message.ontology-constraint-clashes-with', {
        sentence: sentenceOf(partner),
      });
    }

    return readableMessage(violation.message);
  };
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });

  const renderChevron = (axiom: OntologyAxiom) => {
    if (!conflicts.has(axiom.id)) {
      return null;
    }
    const isExpanded = expanded.has(axiom.id);

    return (
      <ButtonUtility
        aria-expanded={isExpanded}
        color="tertiary"
        data-testid="ontology-constraint-expand"
        icon={isExpanded ? ChevronDown : ChevronRight}
        size="xs"
        tooltip={t(
          isExpanded
            ? 'label.hide-conflict-details'
            : 'label.show-conflict-details'
        )}
        onPress={() => toggleExpanded(axiom.id)}
      />
    );
  };

  const columns: DefinitionColumn<OntologyAxiom>[] = [
    {
      id: 'expand',
      label: '',
      width: 'tw:w-12',
      render: renderChevron,
    },
    {
      id: 'sentence',
      isRowHeader: true,
      label: t('label.sentence'),
      render: (axiom) => (
        <Box align="center" gap={2}>
          {conflicts.has(axiom.id) ? (
            <span
              aria-hidden
              className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-error-secondary"
            />
          ) : null}
          <Typography as="span" className="tw:line-clamp-2" size="text-sm">
            {sentenceOf(axiom)}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'type',
      label: t('label.type'),
      width: 'tw:w-36',
      render: (axiom) => (
        <Typography as="span" color="secondary" size="text-sm">
          {axiomTypeLabel(axiom.axiomType, t)}
        </Typography>
      ),
    },
    {
      id: 'source',
      label: t('label.source'),
      width: 'tw:w-36',
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
        <Typography
          ellipsis
          as="span"
          color={axiom.description ? 'secondary' : 'quaternary'}
          size="text-sm">
          {axiom.description || EMPTY}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: t('label.status'),
      width: 'tw:w-28',
      render: (axiom) => <StatusText status={statusOf(axiom)} />,
    },
    {
      id: 'graph',
      label: '',
      width: 'tw:w-36',
      align: 'end',
      render: (axiom) => {
        const conceptId = conceptIdOf(axiom);

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

  const renderDetail = (
    axiom: OntologyAxiom,
    open: (axiom: OntologyAxiom) => void
  ): ReactNode => {
    const conflict = expanded.has(axiom.id)
      ? conflicts.get(axiom.id)
      : undefined;

    return conflict ? (
      <ConflictDetail
        axiom={axiom}
        conceptIdOf={conceptIdOf}
        conflict={conflict}
        explanation={explain(conflict)}
        onOpenAxiom={open}
        onOpenConcept={onOpenConcept}
      />
    ) : null;
  };

  const options = filterOptions(t, model?.axioms ?? []);
  const toolbar = (
    <>
      {validation.data ? (
        <ConflictsChip
          count={conflicts.size}
          isOn={status === 'conflict'}
          onToggle={() => setStatus(status === 'conflict' ? ALL : 'conflict')}
        />
      ) : null}
      <FilterSelect
        label={t('label.type')}
        options={options.type}
        testId="ontology-definition-type-filter"
        value={axiomType}
        onChange={setAxiomType}
      />
      <FilterSelect
        label={t('label.status')}
        options={options.status}
        testId="ontology-definition-status-filter"
        value={status}
        onChange={setStatus}
      />
      <FilterSelect
        label={t('label.source')}
        options={options.source}
        testId="ontology-definition-source-filter"
        value={provenance}
        onChange={setProvenance}
      />
    </>
  );
  const actions = (
    <>
      <ValidationError isError={validation.isError} />
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

  return (
    <OntologyDefinitionList
      hideNameColumn
      actions={actions}
      canCreate={canCreate}
      columns={columns}
      definitionType="axiom"
      filterKey={[axiomType, status, provenance].join('|')}
      isError={isError}
      items={items}
      ontology={ontology}
      renderDetail={renderDetail}
      rowClassName={(axiom) =>
        conflicts.has(axiom.id) ? 'tw:bg-error-primary' : undefined
      }
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
      {(axiom, canEdit, onSaved, close) => (
        <OntologyAxiomEditor
          axiom={axiom}
          canEdit={canEdit}
          ontology={ontology}
          references={references}
          onCancel={close}
          onSaved={onSaved}
        />
      )}
    </OntologyDefinitionList>
  );
};

export default OntologyAxiomWorkspace;
