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
  Box,
  Button,
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  Copy01,
  SearchRefraction,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Direction } from '../../../../generated/api/data/ontologyConceptQuery';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { generateOntologyConceptQuery } from '../../../../rest/ontologyAPI';
import { getInverseRelationLabel } from '../../../../utils/governance/ontology/OntologyNativeRelation.utils';
import {
  getConceptRelationRows,
  getModelRelationLabel,
  humanizeName,
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import ontologyExplorerClassBase from '../../../../utils/OntologyExplorerClassBase';
import { getErrorText } from '../../../../utils/StringUtils';
import {
  InspectorEmptyText,
  InspectorSection,
} from '../../../OntologyExplorer/OntologyInspectorSection';

interface OntologyConceptLiveDataProps {
  readonly concept: OntologyConcept;
  readonly model: OntologyStudioModel;
  readonly relations: OntologyModelRelation[];
}

export interface SearchAroundStep {
  readonly direction: Direction;
  readonly key: string;
  readonly label: string;
  readonly propertyId: string;
  readonly target: OntologyConcept;
}

export const getSearchAroundSteps = (
  relations: OntologyModelRelation[],
  model: OntologyStudioModel,
  conceptId: string
): SearchAroundStep[] => {
  const steps = new Map<string, SearchAroundStep>();
  getConceptRelationRows(relations, conceptId).forEach(
    ({ direction: rowDirection, other, relation }) => {
      const property = relation.property;
      if (property?.kind !== Kind.Object) {
        return;
      }
      const direction =
        rowDirection === 'incoming' ? Direction.Incoming : Direction.Outgoing;
      const inverse =
        direction === Direction.Incoming
          ? getInverseRelationLabel(relation, model)
          : undefined;
      const key = `${property.id}:${direction}:${other.id}`;
      steps.set(key, {
        direction,
        key,
        label: humanizeName(inverse ?? getModelRelationLabel(relation)),
        propertyId: property.id,
        target: other,
      });
    }
  );

  return [...steps.values()];
};

/** A step taken, keyed by the steps that lead to it, since a path may revisit a relation. */
interface SearchAroundHop extends SearchAroundStep {
  readonly path: string;
}

/** The server accepts at most this many hops per query. */
const MAX_HOPS = 5;

const conceptName = (concept: OntologyConcept) =>
  concept.displayName ?? concept.name;

const OntologyConceptLiveData = ({
  concept,
  model,
  relations,
}: OntologyConceptLiveDataProps) => {
  const { t } = useTranslation();
  const [hops, setHops] = useState<SearchAroundHop[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const request = useMemo(
    () =>
      hops.map(({ direction, propertyId, target }) => ({
        property: propertyId,
        target: target.id,
        direction,
      })),
    [hops]
  );
  const query = useQuery({
    queryKey: ['ontology-concept-query', concept.id, request],
    queryFn: ({ signal }) =>
      generateOntologyConceptQuery(concept.id, request, signal),
    retry: false,
  });
  const sql = query.data?.sql ?? '';
  const { hasCopied, onCopyToClipBoard } = useClipboard(sql);
  const lastConcept = hops.at(-1)?.target ?? concept;
  const steps = useMemo(
    () => getSearchAroundSteps(relations, model, lastConcept.id),
    [lastConcept.id, model, relations]
  );
  const LiveDataExtension =
    ontologyExplorerClassBase.getConceptLiveDataExtension();

  const addHop = (step: SearchAroundStep) => {
    setHops((current) => [
      ...current,
      { ...step, path: [...current.map(({ key }) => key), step.key].join('/') },
    ]);
    setIsPicking(false);
  };

  const renderSql = () => {
    if (query.isError) {
      return (
        <InspectorEmptyText>
          {getErrorText(
            query.error as AxiosError,
            t('message.ontology-live-data-unavailable')
          )}
        </InspectorEmptyText>
      );
    }
    if (!query.data) {
      return (
        <Typography color="secondary" size="text-xs">
          {t('label.generating')}
        </Typography>
      );
    }

    return (
      <pre
        className="tw:m-0 tw:overflow-x-auto tw:whitespace-pre tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3 tw:font-mono tw:text-xs tw:text-primary"
        data-testid="ontology-live-data-sql">
        {sql}
      </pre>
    );
  };

  const renderSearchAround = () => {
    if (hops.length >= MAX_HOPS) {
      return null;
    }
    if (!isPicking) {
      return (
        <Button
          color="secondary"
          data-testid="ontology-live-data-search-around"
          iconLeading={SearchRefraction}
          size="xs"
          onPress={() => setIsPicking(true)}>
          {t('label.search-around')}
        </Button>
      );
    }

    return (
      <Card
        data-testid="ontology-live-data-search-around-options"
        size="sm"
        variant="muted">
        <Card.Content>
          <Box direction="col" gap={1}>
            {steps.length > 0 ? (
              steps.map((step) => (
                <Button
                  noTextPadding
                  className="tw:justify-start"
                  color="tertiary"
                  data-testid={`ontology-live-data-hop-option-${step.key}`}
                  key={step.key}
                  size="xs"
                  onPress={() => addHop(step)}>
                  {step.label} · {conceptName(step.target)}
                </Button>
              ))
            ) : (
              <Typography color="secondary" size="text-xs">
                {t('message.ontology-search-around-unavailable', {
                  concept: conceptName(lastConcept),
                })}
              </Typography>
            )}
            <Button
              color="link-gray"
              size="xs"
              onPress={() => setIsPicking(false)}>
              {t('label.cancel')}
            </Button>
          </Box>
        </Card.Content>
      </Card>
    );
  };

  return (
    <InspectorSection testId="ontology-concept-live-data">
      <Box align="center" className="tw:min-h-8" gap={2}>
        {/* not-prose: Typography wraps a heading in .prose, whose h3 style
            (20px, margins) would otherwise outrank the size classes. That
            also drops the prose heading colour, and core has no primary
            Typography color, so the class restores it. */}
        <Typography
          as="h3"
          className="not-prose tw:m-0 tw:text-primary"
          size="text-sm"
          weight="semibold">
          {t('label.live-data')}
        </Typography>
        <Badge
          color="gray"
          data-testid="ontology-live-data-not-stored"
          size="sm"
          type="pill-color">
          {t('label.not-stored')}
        </Badge>
        <ButtonUtility
          className="tw:ml-auto"
          color="tertiary"
          data-testid="ontology-live-data-copy"
          icon={hasCopied ? Check : Copy01}
          isDisabled={!sql}
          size="xs"
          tooltip={
            hasCopied
              ? t('label.copied')
              : t('label.copy-item', { item: t('label.sql-uppercase') })
          }
          onClick={() => onCopyToClipBoard(sql)}
        />
        <span
          aria-live="polite"
          className="tw:sr-only"
          data-testid="ontology-live-data-copy-status">
          {hasCopied ? t('label.copied') : ''}
        </span>
      </Box>
      {hops.length > 0 ? (
        <Box
          align="center"
          data-testid="ontology-live-data-hops"
          gap={1}
          wrap="wrap">
          {hops.map((hop) => (
            <Badge color="brand" key={hop.path} size="sm" type="pill-color">
              {hop.label} · {conceptName(hop.target)}
            </Badge>
          ))}
          <ButtonUtility
            color="tertiary"
            data-testid="ontology-live-data-remove-hop"
            icon={XClose}
            size="xs"
            tooltip={t('label.remove-last-hop')}
            onClick={() => setHops((current) => current.slice(0, -1))}
          />
        </Box>
      ) : null}
      {renderSql()}
      {renderSearchAround()}
      {LiveDataExtension && query.data ? (
        <LiveDataExtension conceptId={concept.id} query={query.data} />
      ) : null}
    </InspectorSection>
  );
};

export default OntologyConceptLiveData;
