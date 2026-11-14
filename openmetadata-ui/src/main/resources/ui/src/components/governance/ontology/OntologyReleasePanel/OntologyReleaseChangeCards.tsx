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
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeType,
  ConceptChange,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  ChangeCard,
  ChangeCardKind,
  ChangeRow,
  conceptChangeLabel,
} from './OntologyReleaseChanges.utils';
import { CHANGE_ROWS_PAGE_SIZE } from './OntologyReleasePanel.constants';

const CHANGE_BADGE_COLOR = {
  [ChangeType.Added]: 'success',
  [ChangeType.Changed]: 'warning',
  [ChangeType.Deprecated]: 'gray',
  [ChangeType.Removed]: 'error',
} as const;

const CARD_TITLES: Record<ChangeCardKind, string> = {
  concepts: 'label.concept-plural',
  properties: 'label.property-plural',
  relationships: 'label.relationship-plural',
  rules: 'label.rule-plural',
  ontology: 'label.ontology-settings',
};

const ChangeRowItem = ({ row }: { row: ChangeRow }) => {
  const { t } = useTranslation();
  const { group, member } = row;
  const groupText = (value: ConceptChange) =>
    value.concept
      ? t('message.ontology-class-change-summary', {
          concept: conceptChangeLabel(value),
          parents: value.parents.length ? ' ⊑ ' + value.parents.join(', ') : '',
          count: value.propertyCount,
        })
      : value.changes.map((change) => getEntityName(change.entity)).join(', ');
  const description = member?.entity.description;

  return (
    <li
      className="tw:flex tw:items-start tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3"
      data-testid={group ? 'ontology-working-concept-group' : undefined}>
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Typography
          className="tw:break-words"
          data-testid={group ? 'ontology-working-concept-summary' : undefined}
          size="text-sm">
          {group ? groupText(group) : getEntityName(member?.entity)}
        </Typography>
        {description ? (
          <Typography
            className="tw:line-clamp-1"
            color="quaternary"
            size="text-xs">
            {description}
          </Typography>
        ) : null}
      </Box>
      <Badge
        color={CHANGE_BADGE_COLOR[row.changeType]}
        size="sm"
        type="pill-color">
        {t('label.' + row.changeType.toLowerCase())}
      </Badge>
    </li>
  );
};

const ChangeCardSection = ({ kind, rows }: ChangeCard) => {
  const { t } = useTranslation();
  const [shownCount, setShownCount] = useState(CHANGE_ROWS_PAGE_SIZE);
  const shownRows = rows.slice(0, shownCount);

  return (
    <details
      open
      className="tw:group tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
      data-testid={`ontology-change-card-${kind}`}>
      <summary className="tw:flex tw:cursor-pointer tw:list-none tw:items-center tw:gap-2 tw:bg-secondary_alt tw:px-4 tw:py-3">
        <ChevronDown
          aria-hidden="true"
          className="tw:size-4 tw:shrink-0 tw:-rotate-90 tw:text-fg-quaternary tw:group-open:rotate-0"
        />
        <Typography
          as="span"
          className="tw:flex-1"
          size="text-sm"
          weight="semibold">
          {t(CARD_TITLES[kind])}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {rows.length}
        </Badge>
      </summary>
      <ul className="tw:m-0 tw:list-none tw:p-0">
        {shownRows.map((row) => (
          <ChangeRowItem key={row.key} row={row} />
        ))}
      </ul>
      {rows.length > shownRows.length ? (
        <Box
          align="center"
          className="tw:border-t tw:border-secondary tw:px-4 tw:py-3"
          gap={3}
          justify="between">
          <Typography color="tertiary" size="text-xs">
            {t('label.kg-showing-of', {
              shown: shownRows.length,
              total: rows.length,
            })}
          </Typography>
          <Button
            color="secondary"
            data-testid={`ontology-change-card-${kind}-load-more`}
            size="sm"
            onPress={() =>
              setShownCount((count) => count + CHANGE_ROWS_PAGE_SIZE)
            }>
            {t('label.load-more-lowercase')}
          </Button>
        </Box>
      ) : null}
    </details>
  );
};

/** The review dialog's changes, one collapsible card per kind of definition. */
const OntologyReleaseChangeCards = ({
  cards,
}: {
  readonly cards: ChangeCard[];
}) => (
  <Box data-testid="ontology-change-groups" direction="col" gap={3}>
    {cards.map((card) => (
      <ChangeCardSection key={card.kind} {...card} />
    ))}
  </Box>
);

export default OntologyReleaseChangeCards;
