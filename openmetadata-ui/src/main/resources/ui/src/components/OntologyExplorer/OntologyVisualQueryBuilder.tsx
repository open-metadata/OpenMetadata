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
  SelectItemType,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Code01,
  Copy01,
  Play,
  Plus,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Ontology } from '../../generated/entity/data/ontology';
import { OntologyConcept } from '../../generated/entity/data/ontologyConcept';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useAuth } from '../../hooks/authHooks';
import { useOntologyStudioModel } from '../../hooks/governance/ontology/useOntologyStudioModel';
import { useClipboard } from '../../hooks/useClipBoard';
import { getGlossaryTerms } from '../../rest/glossaryAPI';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import {
  runGlossarySparqlQuery,
  runOntologySparqlQuery,
  runSparqlQuery,
  SparqlPlaygroundResult,
} from '../../rest/rdfAPI';
import {
  buildNativePropertyQuery,
  buildNativeVisualSparqlQuery,
  DEFAULT_QUERY_LIMIT,
  getNativeQueryRelations,
  NativePropertyConditionKind,
  QUERY_LIMITS,
} from '../../utils/governance/ontology/OntologyNativeQuery.utils';
import { humanizeName } from '../../utils/governance/ontology/OntologyStudioModel.utils';
import { generateUUID } from '../../utils/StringUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { DEFAULT_RELATIONSHIP_TYPE } from './OntologyExplorer.constants';
import { OntologyGraphData, OntologyNode } from './OntologyExplorer.interface';
import {
  describeQueryError,
  QueryErrorDisplay,
} from './OntologyQueryError.utils';
import OntologyQueryResults, {
  QueryResultsEmptyState,
} from './OntologyQueryResults';
import {
  buildQueryScopeLabel,
  OntologyQueryScope,
} from './OntologyQueryScope.utils';
import { getRelationshipColor } from './utils/relationshipTypeUtils';

const ONTOLOGY_NAMESPACE = 'https://open-metadata.org/ontology/';

export type VisualQueryFindKind = 'concepts' | 'metrics' | 'any' | 'properties';

// The RDF class each glossary "Find" choice restricts ?concept to; "any" leaves it open.
const FIND_KIND_CLASSES: Partial<Record<VisualQueryFindKind, string>> = {
  concepts: 'om:GlossaryTerm',
  metrics: 'om:Metric',
};

const FIND_KIND_LABEL_KEYS: Record<VisualQueryFindKind, string> = {
  any: 'label.any-term',
  concepts: 'label.concept-plural',
  metrics: 'label.metric-plural',
  properties: 'label.property-plural',
};

const NATIVE_FIND_KINDS: VisualQueryFindKind[] = ['concepts', 'properties'];

const GLOSSARY_FIND_KINDS: VisualQueryFindKind[] = [
  'concepts',
  'metrics',
  'any',
];

const PROPERTY_CONDITION_LABEL_KEYS: Record<
  NativePropertyConditionKind,
  string
> = {
  domain: 'label.is-on',
  range: 'label.points-to',
};

// Readable headers for the native result variables; glossary results keep their ?variables.
const NATIVE_COLUMN_LABEL_KEYS: Partial<
  Record<VisualQueryFindKind, Record<string, string>>
> = {
  concepts: {
    label: 'label.concept',
    concept: 'label.iri',
    parent: 'label.parent',
  },
  properties: {
    propertyName: 'label.property',
    domain: 'label.on-title',
    range: 'label.range',
  },
};

const LIMIT_ITEMS: SelectItemType[] = QUERY_LIMITS.map((limit) => ({
  id: String(limit),
  label: String(limit),
}));

interface VisualQueryTerm {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
  glossaryId?: string;
}

export interface VisualQueryCondition {
  readonly relationType: RelationshipType;
  readonly target: VisualQueryTerm;
}

interface ConditionRow {
  readonly id: string;
  readonly relation: string;
  readonly target: string;
}

type ConditionDraft = Omit<ConditionRow, 'id'>;

interface OntologyVisualQueryBuilderProps {
  ontology?: Ontology;
  graphData?: OntologyGraphData | null;
  relationTypes?: RelationshipType[];
  selectedGlossaryIds?: string[];
  queryScope?: OntologyQueryScope;
  onEditAsSparql?: (query: string) => void;
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeName(value: string | undefined): string {
  return (value ?? '').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase();
}

/** Glossary terms of the chosen kind that satisfy every condition (ANDed). */
export function buildVisualSparqlQuery(
  conditions: VisualQueryCondition[],
  findKind: VisualQueryFindKind = 'concepts',
  limit = DEFAULT_QUERY_LIMIT
): string {
  const findClass = FIND_KIND_CLASSES[findKind];
  const typeFilter = findClass ? [`  ?concept a ${findClass} .`] : [];
  const patterns = conditions.flatMap(({ relationType, target }, index) => {
    const variable = index === 0 ? '?target' : `?target${index + 1}`;
    const predicate =
      relationType.rdfPredicate ??
      `${ONTOLOGY_NAMESPACE}${encodeURIComponent(relationType.name)}`;

    return [
      `  ?concept <${predicate}> ${variable} .`,
      `  ${variable} om:fullyQualifiedName "${escapeSparqlLiteral(
        target.fullyQualifiedName ?? ''
      )}" .`,
    ];
  });

  return [
    `PREFIX om: <${ONTOLOGY_NAMESPACE}>`,
    '',
    'SELECT ?concept ?conceptFqn WHERE {',
    '  ?concept om:fullyQualifiedName ?conceptFqn .',
    ...typeFilter,
    ...patterns,
    '}',
    `LIMIT ${limit}`,
  ].join('\n');
}

function isGlossaryTermNode(node: OntologyNode): boolean {
  return node.type === 'glossaryTerm' || node.type === 'glossaryTermIsolated';
}

function toVisualQueryTerm(term: GlossaryTerm): VisualQueryTerm {
  return {
    id: term.id,
    name: term.name,
    displayName: term.displayName,
    fullyQualifiedName: term.fullyQualifiedName,
    glossaryId: term.glossary?.id,
  };
}

function getGraphTerms(
  graphData: OntologyGraphData | null | undefined,
  selectedGlossaryIds: string[] | undefined
): VisualQueryTerm[] {
  if (!graphData) {
    return [];
  }

  return graphData.nodes
    .filter(isGlossaryTermNode)
    .filter(
      (node) =>
        !selectedGlossaryIds?.length ||
        (node.glossaryId && selectedGlossaryIds.includes(node.glossaryId))
    )
    .map((node) => ({
      id: node.id,
      name: node.originalLabel ?? node.label,
      displayName: node.label,
      fullyQualifiedName: node.fullyQualifiedName,
      glossaryId: node.glossaryId,
    }));
}

function getInitialBuilderSelection(
  graphData: OntologyGraphData | null | undefined,
  relationTypes: RelationshipType[],
  terms: VisualQueryTerm[]
): ConditionDraft {
  const termIds = new Set(terms.map((term) => term.id));
  const relationByNormalizedName = new Map(
    relationTypes.map((relation) => [normalizeName(relation.name), relation])
  );
  const matchingEdge = graphData?.edges.find(
    (edge) =>
      termIds.has(edge.to) &&
      relationByNormalizedName.has(normalizeName(edge.relationType))
  );
  const matchingRelation = matchingEdge
    ? relationByNormalizedName.get(normalizeName(matchingEdge.relationType))
    : undefined;
  const defaultRelation =
    matchingRelation ??
    relationTypes.find(
      (relation) => normalizeName(relation.name) === 'relatedto'
    ) ??
    relationTypes[0] ??
    DEFAULT_RELATIONSHIP_TYPE;

  return {
    relation: defaultRelation.name,
    target: matchingEdge?.to ?? terms[0]?.id ?? '',
  };
}

const toConditionRow = (draft: ConditionDraft): ConditionRow => ({
  id: generateUUID(),
  ...draft,
});

interface QuerySources {
  readonly concepts: readonly OntologyConcept[];
  readonly nativeRelations: ReturnType<typeof getNativeQueryRelations>;
  readonly relationOptions: RelationshipType[];
  readonly terms: VisualQueryTerm[];
}

interface BuiltQuery {
  readonly query: string;
  readonly incomplete: number;
}

const isPropertyConditionKind = (
  value: string
): value is NativePropertyConditionKind =>
  value in PROPERTY_CONDITION_LABEL_KEYS;

function buildNativeQuery(
  findKind: VisualQueryFindKind,
  rows: ConditionRow[],
  limit: number,
  sources: QuerySources
): BuiltQuery {
  const findConcept = (id: string) =>
    sources.concepts.find((concept) => concept.id === id);
  if (findKind === 'properties') {
    const complete = rows.flatMap(({ relation, target }) => {
      const concept = findConcept(target);

      return concept && isPropertyConditionKind(relation)
        ? [{ kind: relation, target: concept }]
        : [];
    });

    return {
      query: buildNativePropertyQuery(complete, limit),
      incomplete: rows.length - complete.length,
    };
  }
  const complete = rows.flatMap(({ relation, target }) => {
    const concept = findConcept(target);
    const nativeRelation = sources.nativeRelations.find(
      (item) => item.id === relation
    );

    return concept && nativeRelation
      ? [{ relation: nativeRelation.relation, target: concept }]
      : [];
  });

  return {
    query: buildNativeVisualSparqlQuery(complete, limit),
    incomplete: rows.length - complete.length,
  };
}

function buildGlossaryQuery(
  findKind: VisualQueryFindKind,
  rows: ConditionRow[],
  limit: number,
  sources: QuerySources
): BuiltQuery {
  const complete = rows.flatMap(({ relation, target }) => {
    const relationType = sources.relationOptions.find(
      (item) => item.name === relation
    );
    const term = sources.terms.find((item) => item.id === target);

    return relationType && term ? [{ relationType, target: term }] : [];
  });

  return {
    query: buildVisualSparqlQuery(complete, findKind, limit),
    incomplete: rows.length - complete.length,
  };
}

const OntologyVisualQueryBuilder = ({
  ontology,
  graphData,
  relationTypes: suppliedRelationTypes,
  selectedGlossaryIds,
  queryScope,
  onEditAsSparql,
}: OntologyVisualQueryBuilderProps) => {
  const { t } = useTranslation();
  const scopeLabel = queryScope
    ? buildQueryScopeLabel(queryScope, t)
    : undefined;
  const { isAdminUser } = useAuth();
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [terms, setTerms] = useState<VisualQueryTerm[]>([]);
  const [defaultCondition, setDefaultCondition] = useState<ConditionDraft>({
    relation: DEFAULT_RELATIONSHIP_TYPE.name,
    target: '',
  });
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [limit, setLimit] = useState(DEFAULT_QUERY_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [findKind, setFindKind] = useState<VisualQueryFindKind>('concepts');
  const [result, setResult] = useState<{
    readonly data: SparqlPlaygroundResult;
    readonly ranAt: number;
    readonly scopeLabel?: string;
  }>();
  const [queryError, setQueryError] = useState<QueryErrorDisplay>();
  const [isSparqlShown, setIsSparqlShown] = useState(true);
  const selectedGlossaryId = selectedGlossaryIds?.[0];
  const native = useOntologyStudioModel(ontology);
  const nativeRelations = useMemo(
    () => getNativeQueryRelations(native.relations),
    [native.relations]
  );

  const applyDefaultCondition = useCallback((draft: ConditionDraft) => {
    setDefaultCondition(draft);
    setConditions([toConditionRow(draft)]);
  }, []);

  useEffect(() => {
    let active = true;

    if (ontology) {
      setIsLoading(native.isLoading);
      if (native.isError) {
        setQueryError({
          title: t('message.query-error-failed-title'),
          hint: t('message.temporary-error-try-reloading'),
        });
      }
      if (native.model) {
        setTerms([...native.model.concepts]);
        applyDefaultCondition({
          relation: nativeRelations[0]?.id ?? '',
          target:
            nativeRelations[0]?.relation.to.id ??
            native.model.concepts[0]?.id ??
            '',
        });
      }

      return () => {
        active = false;
      };
    }
    const loadBuilderData = async () => {
      const scopedGraphTerms = getGraphTerms(
        graphData,
        selectedGlossaryId ? [selectedGlossaryId] : undefined
      );
      const relationTypesPromise = suppliedRelationTypes?.length
        ? Promise.resolve(suppliedRelationTypes)
        : listRelationshipTypes({ limit: 1000 }).then(
            (response) => response.data
          );
      const termsPromise = scopedGraphTerms.length
        ? Promise.resolve(scopedGraphTerms)
        : getGlossaryTerms({
            limit: 100,
            glossary: selectedGlossaryId,
          }).then((response) => response.data.map(toVisualQueryTerm));

      try {
        const [loadedRelationTypes, loadedTerms] = await Promise.all([
          relationTypesPromise,
          termsPromise,
        ]);
        if (!active) {
          return;
        }
        setRelationTypes(loadedRelationTypes);
        setTerms(loadedTerms);
        applyDefaultCondition(
          getInitialBuilderSelection(
            graphData,
            loadedRelationTypes,
            loadedTerms
          )
        );
      } catch (error) {
        showErrorToast(String(error));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadBuilderData();

    return () => {
      active = false;
    };
  }, [
    applyDefaultCondition,
    graphData,
    selectedGlossaryId,
    suppliedRelationTypes,
    ontology,
    native.isLoading,
    native.isError,
    native.model,
    nativeRelations,
    t,
  ]);

  const relationOptions = useMemo(
    () => (relationTypes.length ? relationTypes : [DEFAULT_RELATIONSHIP_TYPE]),
    [relationTypes]
  );
  const { query: generatedQuery, incomplete } = useMemo(() => {
    const sources: QuerySources = {
      concepts: native.model?.concepts ?? [],
      nativeRelations,
      relationOptions,
      terms,
    };

    return (ontology ? buildNativeQuery : buildGlossaryQuery)(
      findKind,
      conditions,
      limit,
      sources
    );
  }, [
    conditions,
    findKind,
    limit,
    native.model,
    nativeRelations,
    ontology,
    relationOptions,
    terms,
  ]);
  const { hasCopied, onCopyToClipBoard } = useClipboard(generatedQuery);

  const getRelationLabel = useCallback(
    (relation: RelationshipType) =>
      relation.displayName ||
      (relation.name === DEFAULT_RELATIONSHIP_TYPE.name
        ? t('label.related-to')
        : relation.name),
    [t]
  );
  const relationSelectItems = useMemo<SelectItemType[]>(() => {
    if (ontology && findKind === 'properties') {
      return Object.entries(PROPERTY_CONDITION_LABEL_KEYS).map(
        ([id, labelKey]) => ({ id, label: t(labelKey) })
      );
    }
    if (ontology) {
      return nativeRelations.map((item) => ({
        id: item.id,
        label: [
          item.label,
          humanizeName(item.relation.kind),
          item.relation.restriction &&
            [
              humanizeName(item.relation.restriction.kind),
              item.relation.restriction.cardinality,
            ]
              .filter((value) => value !== undefined)
              .join(' '),
        ]
          .filter(Boolean)
          .join(' · '),
      }));
    }

    return relationOptions.map((relation) => ({
      id: relation.name,
      label: getRelationLabel(relation),
      icon: (
        <span
          aria-hidden="true"
          className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-quaternary"
          style={{ backgroundColor: getRelationshipColor(relation) }}
        />
      ),
    }));
  }, [
    ontology,
    findKind,
    nativeRelations,
    getRelationLabel,
    relationOptions,
    t,
  ]);
  const termSelectItems = useMemo<SelectItemType[]>(
    () =>
      terms.map((term) => ({
        id: term.id,
        label: term.displayName || term.name,
      })),
    [terms]
  );

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setResult(undefined);
    setQueryError(undefined);
    try {
      const queryParams = {
        query: generatedQuery,
        format: 'json' as const,
        inference: 'none' as const,
      };
      if (!ontology && !selectedGlossaryId && !isAdminUser) {
        throw new Error(
          t('label.please-select-entity', { entity: t('label.glossary') })
        );
      }
      let data: SparqlPlaygroundResult;
      if (ontology) {
        data = await runOntologySparqlQuery(ontology.id, queryParams, {
          scope: queryScope?.version === 'draft' ? 'draft' : 'release',
        });
      } else if (selectedGlossaryId) {
        data = await runGlossarySparqlQuery(selectedGlossaryId, queryParams);
      } else {
        data = await runSparqlQuery(queryParams);
      }
      setResult({ data, ranAt: Date.now(), scopeLabel });
    } catch (error) {
      setQueryError(
        describeQueryError(error, { isAdmin: Boolean(isAdminUser), t })
      );
    } finally {
      setIsRunning(false);
    }
  }, [
    ontology,
    generatedQuery,
    isAdminUser,
    queryScope?.version,
    scopeLabel,
    selectedGlossaryId,
    t,
  ]);

  const resetResult = () => {
    setResult(undefined);
    setQueryError(undefined);
  };
  const updateConditions = (next: ConditionRow[]) => {
    setConditions(next);
    resetResult();
  };
  const updateCondition = (id: string, change: Partial<ConditionDraft>) =>
    updateConditions(
      conditions.map((row) => (row.id === id ? { ...row, ...change } : row))
    );
  const changeFindKind = (kind: VisualQueryFindKind) => {
    setFindKind(kind);
    // Properties start from an empty "is on" condition; the relation list differs per kind.
    updateConditions([
      toConditionRow(
        kind === 'properties'
          ? { relation: 'domain', target: '' }
          : defaultCondition
      ),
    ]);
  };
  const handleReset = () => {
    setFindKind('concepts');
    setLimit(DEFAULT_QUERY_LIMIT);
    updateConditions([toConditionRow(defaultCondition)]);
  };
  const columnLabels = useMemo(() => {
    const keys = ontology ? NATIVE_COLUMN_LABEL_KEYS[findKind] : undefined;

    return keys
      ? Object.fromEntries(
          Object.entries(keys).map(([variable, key]) => [variable, t(key)])
        )
      : undefined;
  }, [findKind, ontology, t]);
  const incompleteNote =
    incomplete > 0 ? (
      <Typography
        color="secondary"
        data-testid="ontology-builder-incomplete"
        size="text-xs">
        {t('message.incomplete-condition-ignored', { count: incomplete })}
      </Typography>
    ) : null;

  const renderConditionRow = (row: ConditionRow, index: number) => {
    const suffix = index === 0 ? '' : `-${index}`;

    return (
      <Box align="center" gap={3} key={row.id}>
        <Typography
          className="tw:w-10 tw:shrink-0 tw:text-right tw:lowercase"
          color="secondary"
          size="text-sm"
          weight="medium">
          {index === 0 ? t('label.where') : t('label.and-lowercase')}
        </Typography>
        <Select
          aria-label={t('label.relationship-type')}
          className="tw:w-56"
          data-testid={`ontology-builder-relation${suffix}`}
          fontSize="sm"
          isDisabled={isLoading}
          items={relationSelectItems}
          placeholder={t('label.relationship-type')}
          value={row.relation || null}
          onChange={(key) =>
            updateCondition(row.id, { relation: String(key ?? '') })
          }>
          {(item) => (
            <Select.Item
              icon={item.icon}
              id={item.id}
              key={item.id}
              label={item.label}
            />
          )}
        </Select>
        <Select.ComboBox
          showSearchIcon
          aria-label={t(ontology ? 'label.concept' : 'label.target-term')}
          className="tw:w-72"
          data-testid={`ontology-builder-target${suffix}`}
          emptyState={
            ontology
              ? t('label.no-entity-found', {
                  entity: t('label.concept-plural'),
                })
              : t('message.no-terms-found')
          }
          fontSize="sm"
          isDisabled={isLoading}
          items={termSelectItems}
          placeholder={
            ontology
              ? t('label.select-entity', {
                  entity: t('label.concept').toLocaleLowerCase(),
                })
              : t('message.bulk-edit-glossary-terms-search-placeholder')
          }
          shortcut={false}
          value={row.target || null}
          onChange={(key) =>
            updateCondition(row.id, { target: String(key ?? '') })
          }>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select.ComboBox>
        <ButtonUtility
          color="tertiary"
          data-testid={`ontology-builder-remove-condition-${index}`}
          icon={XClose}
          size="sm"
          tooltip={t('label.remove')}
          onClick={() =>
            updateConditions(conditions.filter((item) => item.id !== row.id))
          }
        />
      </Box>
    );
  };

  const renderToolbar = () => (
    <Box align="center" gap={3} wrap="wrap">
      <Typography
        className="tw:w-10 tw:text-right"
        color="secondary"
        size="text-sm"
        weight="medium">
        {t('label.find')}
      </Typography>
      <Tabs
        className="tw:w-auto"
        selectedKey={findKind}
        onSelectionChange={(key) =>
          changeFindKind(String(key) as VisualQueryFindKind)
        }>
        <Tabs.List size="sm" type="button-border">
          {(ontology ? NATIVE_FIND_KINDS : GLOSSARY_FIND_KINDS).map((kind) => (
            <Tabs.Item
              data-testid={`ontology-builder-find-${kind}`}
              id={kind}
              key={kind}>
              {t(FIND_KIND_LABEL_KEYS[kind])}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
      <Box className="tw:h-6 tw:border-l tw:border-secondary" />
      <Typography color="secondary" size="text-sm" weight="medium">
        {t('label.limit')}
      </Typography>
      <Select
        aria-label={t('label.limit')}
        className="tw:w-24"
        data-testid="ontology-builder-limit"
        fontSize="sm"
        items={LIMIT_ITEMS}
        value={String(limit)}
        onChange={(key) => {
          setLimit(Number(key ?? DEFAULT_QUERY_LIMIT));
          resetResult();
        }}>
        {(item) => (
          <Select.Item id={item.id} key={item.id} label={item.label} />
        )}
      </Select>
      <Box align="center" className="tw:ml-auto" gap={2} wrap="wrap">
        {isSparqlShown ? null : (
          <Button
            color="link-color"
            data-testid="ontology-builder-toggle-sparql"
            iconLeading={Code01}
            size="sm"
            onClick={() => setIsSparqlShown(true)}>
            {t('label.show-sparql')}
          </Button>
        )}
        <Button
          color="tertiary"
          data-testid="ontology-builder-reset"
          size="sm"
          onClick={handleReset}>
          {t('label.reset')}
        </Button>
        {onEditAsSparql ? (
          <Button
            color="secondary"
            data-testid="ontology-builder-edit-as-sparql"
            iconLeading={Code01}
            isDisabled={isLoading}
            size="sm"
            onClick={() => onEditAsSparql(generatedQuery)}>
            {t('label.edit-as-sparql')}
          </Button>
        ) : null}
        <Button
          color="primary"
          data-testid="ontology-builder-run"
          iconLeading={Play}
          isDisabled={isLoading || isRunning}
          size="sm"
          onClick={() => void handleRun()}>
          {isRunning ? t('label.running') : t('label.run-query')}
        </Button>
      </Box>
    </Box>
  );

  const renderResults = () => {
    if (queryError) {
      return (
        <Box
          className="tw:rounded-lg tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:px-3 tw:py-2"
          data-testid="ontology-builder-error"
          direction="col"
          role="alert">
          <Typography
            className="tw:text-utility-error-700"
            size="text-sm"
            weight="semibold">
            {queryError.title}
          </Typography>
          <Typography className="tw:text-utility-error-700" size="text-sm">
            {queryError.hint}
          </Typography>
        </Box>
      );
    }
    if (result) {
      return (
        <OntologyQueryResults
          columnLabels={columnLabels}
          graphData={ontology ? native.graph : graphData ?? null}
          meta={incompleteNote}
          ranAt={result.ranAt}
          relationshipTypes={ontology ? [] : relationOptions}
          result={result.data}
          scopeLabel={result.scopeLabel}
        />
      );
    }

    return <QueryResultsEmptyState meta={incompleteNote} />;
  };

  const sparqlLines = generatedQuery.split('\n');

  return (
    <Box
      className="tw:h-full tw:bg-primary"
      data-testid="ontology-visual-query-builder"
      direction="col">
      <Box
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-5 tw:py-4"
        direction="col"
        gap={3}>
        {renderToolbar()}
        {conditions.map(renderConditionRow)}
        <Box className="tw:pl-13">
          <Button
            color="link-color"
            data-testid="ontology-builder-add-condition"
            iconLeading={Plus}
            isDisabled={isLoading}
            size="sm"
            onClick={() =>
              updateConditions([
                ...conditions,
                toConditionRow({
                  relation: String(relationSelectItems[0]?.id ?? ''),
                  target: '',
                }),
              ])
            }>
            {t('label.add-condition')}
          </Button>
        </Box>
      </Box>

      <Box className="tw:min-h-0 tw:flex-1">
        <Box
          className="tw:min-w-0 tw:flex-1 tw:overflow-auto tw:px-5 tw:py-4"
          direction="col"
          gap={3}>
          {renderResults()}
        </Box>
        {isSparqlShown ? (
          <Box
            className="tw:w-96 tw:shrink-0 tw:border-l tw:border-secondary tw:bg-secondary"
            data-testid="ontology-builder-sparql-pane"
            direction="col">
            <Box
              align="center"
              className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-4 tw:py-3"
              gap={1}>
              <Typography
                className="tw:flex-1"
                size="text-sm"
                weight="semibold">
                {t('label.generated-sparql')}
              </Typography>
              <ButtonUtility
                color="tertiary"
                data-testid="ontology-generated-sparql-copy"
                icon={Copy01}
                size="sm"
                tooltip={hasCopied ? t('label.copied') : t('label.copy')}
                onClick={() => void onCopyToClipBoard(generatedQuery)}
              />
              <ButtonUtility
                color="tertiary"
                data-testid="ontology-builder-toggle-sparql"
                icon={XClose}
                size="sm"
                tooltip={t('label.hide-sparql')}
                onClick={() => setIsSparqlShown(false)}
              />
            </Box>
            <Box className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:py-3">
              <pre
                aria-hidden="true"
                className="tw:m-0 tw:shrink-0 tw:px-3 tw:text-right tw:font-mono tw:text-xs tw:leading-5 tw:text-quaternary tw:select-none">
                {sparqlLines.map((_, index) => index + 1).join('\n')}
              </pre>
              <pre
                className="tw:m-0 tw:min-w-0 tw:flex-1 tw:pr-4 tw:font-mono tw:text-xs tw:leading-5 tw:text-secondary"
                data-testid="ontology-generated-sparql">
                {generatedQuery}
              </pre>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default OntologyVisualQueryBuilder;
