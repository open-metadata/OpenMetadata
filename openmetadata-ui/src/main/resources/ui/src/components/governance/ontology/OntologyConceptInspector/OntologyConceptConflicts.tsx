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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronUp,
  Share07,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getModelRelationLabel,
  humanizeName,
  OntologyModelRelation,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  describeConflict,
  getAxiomProvenance,
  OntologyConflict,
} from '../OntologyGraphView/OntologyConflicts.utils';

interface OntologyConceptConflictsProps {
  readonly conflicts: OntologyConflict[];
  /** Opened from the canvas Resolve link; a click on the node leaves it collapsed. */
  readonly defaultOpen?: boolean;
  readonly onRemove?: (relation: OntologyModelRelation) => Promise<boolean>;
  readonly onShowOnGraph: () => void;
}

const partText = (relation: OntologyModelRelation, t: TFunction) =>
  relation.kind === 'disjointWith'
    ? t('message.ontology-conflict-never-be', {
        name: getEntityName(relation.from),
        other: getEntityName(relation.to),
      })
    : t('message.ontology-relation-sentence', {
        from: getEntityName(relation.from),
        relation: humanizeName(getModelRelationLabel(relation)),
        to: getEntityName(relation.to),
      });

const ConflictPartRow = ({
  isRemoving,
  relation,
  onRemove,
}: {
  readonly isRemoving: boolean;
  readonly relation: OntologyModelRelation;
  readonly onRemove?: () => void;
}) => {
  const { t } = useTranslation();
  const provenance = getAxiomProvenance(relation.axiom, t);

  return (
    <li
      className="tw:flex tw:items-center tw:gap-3 tw:border-t tw:border-secondary tw:px-3.5 tw:py-2.5"
      data-testid="ontology-concept-conflict-part">
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
        <Typography size="text-sm" weight="medium">
          {partText(relation, t)}
        </Typography>
        {provenance ? (
          <Typography color="secondary" size="text-xs">
            {provenance}
          </Typography>
        ) : null}
      </Box>
      {onRemove ? (
        <Button
          color="tertiary-destructive"
          data-testid="ontology-concept-conflict-remove"
          isDisabled={isRemoving}
          size="sm"
          onPress={onRemove}>
          {t('label.remove')}
        </Button>
      ) : null}
    </li>
  );
};

/** The drawer's conflict box: why the concept clashes and what can be removed to fix it. */
const OntologyConceptConflicts = ({
  conflicts,
  defaultOpen = false,
  onRemove,
  onShowOnGraph,
}: OntologyConceptConflictsProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [removingKey, setRemovingKey] = useState<string>();
  const remove = async (relation: OntologyModelRelation) => {
    setRemovingKey(relation.key);
    try {
      await onRemove?.(relation);
    } finally {
      setRemovingKey(undefined);
    }
  };

  return (
    <div className="tw:py-5">
      <div
        className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-utility-error-300"
        data-testid="ontology-concept-conflicts">
        <button
          aria-expanded={isOpen}
          className={classNames(
            'tw:flex tw:min-h-10 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2.5 tw:border-0',
            'tw:bg-utility-error-50 tw:px-3 tw:text-left tw:outline-focus-ring tw:focus-visible:outline-2'
          )}
          data-testid="ontology-concept-conflicts-toggle"
          type="button"
          onClick={() => setIsOpen((open) => !open)}>
          <span
            aria-hidden
            className="tw:flex tw:size-4.5 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-error-100">
            <span className="tw:size-1.5 tw:rounded-full tw:bg-fg-error-secondary" />
          </span>
          <Typography
            className="tw:flex-1 tw:text-error-primary"
            size="text-sm"
            weight="semibold">
            {t('label.n-conflicts-to-resolve', { count: conflicts.length })}
          </Typography>
          <Typography
            className="tw:flex tw:items-center tw:gap-1 tw:text-error-primary"
            size="text-sm"
            weight="semibold">
            {t(isOpen ? 'label.hide' : 'label.review')}
            {isOpen ? (
              <ChevronUp aria-hidden className="tw:size-3.5" />
            ) : (
              <ChevronDown aria-hidden className="tw:size-3.5" />
            )}
          </Typography>
        </button>
        {isOpen
          ? conflicts.map((conflict) => (
              <div
                className="tw:flex tw:flex-col tw:border-t tw:border-utility-error-100"
                data-testid="ontology-concept-conflict"
                key={`${conflict.violation.code}-${conflict.violation.message}`}>
                <Box
                  className="tw:px-3.5 tw:pt-3 tw:pb-2.5"
                  direction="col"
                  gap={1}>
                  <Typography size="text-sm" weight="medium">
                    {describeConflict(conflict, t)}
                  </Typography>
                  <Typography color="secondary" size="text-xs">
                    {t('message.ontology-conflict-remove-one')}
                  </Typography>
                </Box>
                <ul className="tw:m-0 tw:list-none tw:p-0">
                  {conflict.parts.map((relation) => (
                    <ConflictPartRow
                      isRemoving={removingKey === relation.key}
                      key={relation.key}
                      relation={relation}
                      onRemove={
                        onRemove && relation.axiom
                          ? () => void remove(relation)
                          : undefined
                      }
                    />
                  ))}
                </ul>
                <div className="tw:border-t tw:border-secondary tw:px-3.5 tw:py-2">
                  <Button
                    color="link-color"
                    data-testid="ontology-concept-conflict-show-on-graph"
                    iconLeading={Share07}
                    size="sm"
                    onPress={onShowOnGraph}>
                    {t('label.show-on-graph')}
                  </Button>
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
};

export default OntologyConceptConflicts;
