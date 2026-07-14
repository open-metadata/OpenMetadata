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

import { Select, SelectItemType } from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  getGlossaryTermRelationSettings,
  getGlossaryTerms,
} from '../../rest/glossaryAPI';
import { runSparqlQuery } from '../../rest/rdfAPI';
import {
  GlossaryTermRelationSettings,
  GlossaryTermRelationType,
} from '../../rest/settingConfigAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { DEFAULT_SPARQL_PREFIXES } from '../SparqlQueryConsole/SparqlQueryConsole.interface';
import { OntologyGraphData, OntologyNode } from './OntologyExplorer.interface';

const ONTOLOGY_NAMESPACE = 'https://open-metadata.org/ontology/';
const DEFAULT_RELATION_TYPE: GlossaryTermRelationType = {
  name: 'relatedTo',
  displayName: '',
  category: 'associative',
  rdfPredicate: `${ONTOLOGY_NAMESPACE}relatedTo`,
};

interface VisualQueryTerm {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
  glossaryId?: string;
}

interface OntologyVisualQueryBuilderProps {
  graphData?: OntologyGraphData | null;
  relationTypes?: GlossaryTermRelationType[];
  selectedGlossaryIds?: string[];
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeName(value: string | undefined): string {
  return (value ?? '').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase();
}

function toSparqlLocalName(
  value: string | undefined,
  fallback: string
): string {
  const localName = (value ?? '').replace(/[^a-z0-9_]/gi, '');

  return localName || fallback;
}

export function buildVisualSparqlQuery(
  relationType: GlossaryTermRelationType | undefined,
  target: VisualQueryTerm | undefined
): string {
  const predicate =
    relationType?.rdfPredicate ??
    `${ONTOLOGY_NAMESPACE}${encodeURIComponent(
      relationType?.name ?? 'relatedTo'
    )}`;
  const targetFilter = target?.fullyQualifiedName
    ? `\n  ?target om:fullyQualifiedName "${escapeSparqlLiteral(
        target.fullyQualifiedName
      )}" .`
    : '';

  return `${DEFAULT_SPARQL_PREFIXES}

SELECT ?concept ?conceptFqn WHERE {
  ?concept <${predicate}> ?target ;
           om:fullyQualifiedName ?conceptFqn .${targetFilter}
}
LIMIT 100`;
}

export function buildVisualSparqlPreview(
  relationType: GlossaryTermRelationType | undefined,
  target: VisualQueryTerm | undefined
): string {
  const predicate = relationType?.rdfPredicate
    ? `<${relationType.rdfPredicate}>`
    : `om:${toSparqlLocalName(relationType?.name, 'relatedTo')}`;
  const targetFilter = target?.fullyQualifiedName
    ? `
  ?target om:fullyQualifiedName "${escapeSparqlLiteral(
    target.fullyQualifiedName
  )}" .`
    : '';

  return `SELECT ?concept ?conceptFqn WHERE {
  ?concept ${predicate} ?target ;
           om:fullyQualifiedName ?conceptFqn .${targetFilter}
}
LIMIT 100`;
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
  relationTypes: GlossaryTermRelationType[],
  terms: VisualQueryTerm[]
): { relationName: string; targetId: string } {
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
    DEFAULT_RELATION_TYPE;

  return {
    relationName: defaultRelation.name,
    targetId: matchingEdge?.to ?? terms[0]?.id ?? '',
  };
}

const OntologyVisualQueryBuilder = ({
  graphData,
  relationTypes: suppliedRelationTypes,
  selectedGlossaryIds,
}: OntologyVisualQueryBuilderProps) => {
  const { t } = useTranslation();
  const [relationTypes, setRelationTypes] = useState<
    GlossaryTermRelationType[]
  >([]);
  const [terms, setTerms] = useState<VisualQueryTerm[]>([]);
  const [selectedRelation, setSelectedRelation] = useState(
    DEFAULT_RELATION_TYPE.name
  );
  const [selectedTarget, setSelectedTarget] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [matchCount, setMatchCount] = useState<number>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const selectedGlossaryId = selectedGlossaryIds?.[0];

  useEffect(() => {
    let active = true;

    const loadBuilderData = async () => {
      const scopedGraphTerms = getGraphTerms(
        graphData,
        selectedGlossaryId ? [selectedGlossaryId] : undefined
      );
      const relationTypesPromise = suppliedRelationTypes?.length
        ? Promise.resolve(suppliedRelationTypes)
        : getGlossaryTermRelationSettings().then(
            (settings) =>
              (settings as GlossaryTermRelationSettings)?.relationTypes ?? []
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
        const selection = getInitialBuilderSelection(
          graphData,
          loadedRelationTypes,
          loadedTerms
        );

        setRelationTypes(loadedRelationTypes);
        setTerms(loadedTerms);
        setSelectedRelation(selection.relationName);
        setSelectedTarget(selection.targetId);
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
  }, [graphData, selectedGlossaryId, suppliedRelationTypes]);

  const relationOptions = useMemo(
    () => (relationTypes.length ? relationTypes : [DEFAULT_RELATION_TYPE]),
    [relationTypes]
  );
  const selectedRelationType = useMemo(
    () =>
      relationOptions.find((relation) => relation.name === selectedRelation) ??
      DEFAULT_RELATION_TYPE,
    [relationOptions, selectedRelation]
  );
  const selectedTargetTerm = useMemo(
    () => terms.find((term) => term.id === selectedTarget),
    [terms, selectedTarget]
  );
  const generatedQuery = useMemo(
    () => buildVisualSparqlQuery(selectedRelationType, selectedTargetTerm),
    [selectedRelationType, selectedTargetTerm]
  );
  const queryPreview = useMemo(
    () => buildVisualSparqlPreview(selectedRelationType, selectedTargetTerm),
    [selectedRelationType, selectedTargetTerm]
  );

  const getRelationLabel = useCallback(
    (relation: GlossaryTermRelationType) =>
      relation.displayName ||
      (relation.name === DEFAULT_RELATION_TYPE.name
        ? t('label.related-to')
        : relation.name),
    [t]
  );
  const relationSelectItems = useMemo<SelectItemType[]>(
    () =>
      relationOptions.map((relation) => ({
        id: relation.name,
        label: getRelationLabel(relation),
        icon: (
          <span
            aria-hidden="true"
            className="tw:size-2 tw:shrink-0 tw:rounded-[3px] tw:bg-warning-600"
            style={
              relation.color ? { backgroundColor: relation.color } : undefined
            }
          />
        ),
      })),
    [getRelationLabel, relationOptions]
  );
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
    setMatchCount(undefined);
    setErrorMessage(undefined);
    try {
      const result = await runSparqlQuery({
        query: generatedQuery,
        format: 'json',
        inference: 'none',
      });
      setMatchCount(result.parsed?.results?.bindings?.length ?? 0);
    } catch (error) {
      const message = isAxiosError(error)
        ? typeof error.response?.data === 'string'
          ? error.response.data
          : error.message
        : (error as Error).message;
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsRunning(false);
    }
  }, [generatedQuery]);

  return (
    <div
      className="tw:h-full tw:min-h-[540px] tw:bg-gray-warm-100"
      data-testid="ontology-visual-query-builder">
      <div className="tw:max-w-[640px] tw:px-[26px] tw:py-[22px]">
        <h2 className="tw:mb-[3px] tw:font-body tw:text-[15px] tw:leading-[normal] tw:font-semibold tw:text-gray-900">
          {t('label.visual-query-builder')}
        </h2>
        <p className="tw:mb-[18px] tw:font-body tw:text-xs tw:leading-[normal] tw:font-normal tw:text-gray-500">
          {t('message.visual-query-builder-description')}
        </p>

        <div className="tw:mb-4 tw:flex tw:flex-col tw:gap-2.5">
          <div className="tw:flex tw:items-center tw:gap-[9px]">
            <span className="tw:w-11 tw:text-right tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-500">
              {t('label.find')}
            </span>
            <span
              className={classNames(
                'tw:inline-flex tw:items-center tw:rounded-lg tw:border tw:border-gray-300',
                'tw:bg-white tw:px-[11px] tw:py-2 tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium tw:text-gray-900'
              )}>
              {t('label.concept-plural')}
            </span>
          </div>

          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-[9px]">
            <span className="tw:w-11 tw:text-right tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-500 tw:lowercase">
              {t('label.where')}
            </span>
            <Select
              aria-label={t('label.relationship-type')}
              className="tw:w-52 [&_button]:tw:bg-warning-50 [&_button]:tw:ring-warning-200 [&_button_p]:tw:text-warning-700"
              data-testid="ontology-builder-relation"
              fontSize="xs"
              isDisabled={isLoading}
              items={relationSelectItems}
              placeholder={t('label.relationship-type')}
              size="sm"
              value={selectedRelation}
              onChange={(key) => {
                setSelectedRelation(String(key ?? ''));
                setMatchCount(undefined);
                setErrorMessage(undefined);
              }}>
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
              aria-label={t('label.target-term')}
              className="tw:w-72"
              data-testid="ontology-builder-target"
              emptyState={t('message.no-terms-found')}
              fontSize="xs"
              isDisabled={isLoading}
              items={termSelectItems}
              placeholder={t(
                'message.bulk-edit-glossary-terms-search-placeholder'
              )}
              shortcut={false}
              size="sm"
              value={selectedTarget || null}
              onChange={(key) => {
                setSelectedTarget(String(key ?? ''));
                setMatchCount(undefined);
                setErrorMessage(undefined);
              }}>
              {(item) => (
                <Select.Item id={item.id} key={item.id} label={item.label} />
              )}
            </Select.ComboBox>
          </div>
        </div>

        <h3 className="tw:mb-[7px] tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.05em] tw:text-gray-500 tw:uppercase">
          {t('label.generated-sparql')}
        </h3>
        <pre
          className="tw:mb-4 tw:overflow-auto tw:rounded-[9px] tw:bg-primary-solid tw:px-3.5 tw:py-3 tw:font-mono tw:text-[11px] tw:leading-[1.7] tw:font-normal tw:text-gray-300"
          data-testid="ontology-generated-sparql">
          {queryPreview}
        </pre>

        <div className="tw:flex tw:items-center tw:gap-2.5">
          <button
            className={classNames(
              'tw:rounded-lg tw:border-0 tw:bg-brand-solid tw:px-[17px] tw:py-2.5',
              'tw:font-body tw:text-[13px] tw:leading-[normal] tw:font-semibold tw:text-white tw:shadow-xs-skeuomorphic',
              'disabled:tw:cursor-not-allowed disabled:tw:opacity-60'
            )}
            data-testid="ontology-builder-run"
            disabled={isLoading || isRunning || !selectedTarget}
            type="button"
            onClick={() => void handleRun()}>
            {isRunning ? t('label.running') : t('label.run-query')}
          </button>

          {matchCount !== undefined ? (
            <span
              className={classNames(
                'tw:inline-flex tw:items-center tw:rounded-full tw:border tw:border-success-200',
                'tw:bg-success-50 tw:px-3 tw:py-1.5 tw:font-body tw:text-xs tw:leading-[normal] tw:font-semibold tw:text-success-700'
              )}
              data-testid="ontology-builder-result">
              {t('message.ontology-query-concepts-match', {
                count: matchCount,
              })}
            </span>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="tw:mt-3 tw:rounded-lg tw:border tw:border-error-200 tw:bg-error-50 tw:px-3 tw:py-2 tw:font-body tw:text-xs tw:text-error-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OntologyVisualQueryBuilder;
