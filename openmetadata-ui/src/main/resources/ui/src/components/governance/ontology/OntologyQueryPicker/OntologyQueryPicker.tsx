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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  useOntologyConceptCounts,
  useOntologyPropertyCounts,
} from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { getEntityName } from '../../../../utils/EntityNameUtils';

interface OntologyQueryPickerProps {
  readonly ontologies: Ontology[];
  readonly surface: 'console' | 'builder';
  readonly onSelect: (ontology: Ontology) => void;
}

const COUNT_SEPARATOR = ' · ';
const ROWS_PER_PAGE = 20;

/** Query mode on All ontologies: a query reads one ontology, so the user picks it here. */
const OntologyQueryPicker = ({
  ontologies,
  surface,
  onSelect,
}: OntologyQueryPickerProps) => {
  const { t } = useTranslation();
  const [shown, setShown] = useState(ROWS_PER_PAGE);
  // Counts cost one request per row, so only the rows on screen are counted.
  const visibleOntologies = ontologies.slice(0, shown);
  const conceptCounts = useOntologyConceptCounts(visibleOntologies, true);
  const propertyCounts = useOntologyPropertyCounts(visibleOntologies, true);

  const describeCounts = (ontology: Ontology) => {
    const concepts = conceptCounts[ontology.id];
    const properties = propertyCounts[ontology.id];
    const parts: string[] = [];
    if (concepts !== undefined) {
      const label = t(
        concepts === 1 ? 'label.concept' : 'label.concept-plural'
      );
      parts.push(`${concepts} ${label.toLocaleLowerCase()}`);
    }
    if (properties !== undefined) {
      const label = t(
        properties === 1 ? 'label.property' : 'label.property-plural'
      );
      parts.push(`${properties} ${label.toLocaleLowerCase()}`);
    }

    return parts.join(COUNT_SEPARATOR);
  };

  return (
    <Box
      className="tw:max-w-190 tw:p-6"
      data-testid="ontology-query-picker"
      direction="col"
      gap={4}>
      <Box direction="col" gap={1}>
        <Typography
          data-testid="ontology-query-picker-title"
          size="text-lg"
          weight="semibold">
          {t('message.query-choose-ontology-title')}
        </Typography>
        <Typography
          className="tw:text-tertiary"
          data-testid="ontology-query-picker-description"
          size="text-sm">
          {t(`message.query-choose-ontology-${surface}`)}
        </Typography>
      </Box>
      <Box
        className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
        direction="col">
        {visibleOntologies.map((ontology) => (
          <Button
            noTextPadding
            className="tw:justify-between tw:border-b tw:border-secondary tw:px-4 tw:py-3 tw:text-left tw:last:border-b-0"
            color="tertiary"
            data-testid={`ontology-query-picker-option-${ontology.id}`}
            key={ontology.id}
            size="md"
            onClick={() => onSelect(ontology)}>
            <Typography className="tw:truncate" size="text-sm" weight="medium">
              {getEntityName(ontology)}
            </Typography>
            <Typography
              className="tw:shrink-0 tw:text-tertiary"
              data-testid="ontology-query-picker-counts"
              size="text-xs">
              {describeCounts(ontology)}
            </Typography>
          </Button>
        ))}
      </Box>
      {ontologies.length > shown && (
        <Button
          color="secondary"
          data-testid="ontology-query-picker-show-more"
          size="sm"
          onClick={() => setShown((count) => count + ROWS_PER_PAGE)}>
          {t('label.show-more')}
        </Button>
      )}
    </Box>
  );
};

export default OntologyQueryPicker;
