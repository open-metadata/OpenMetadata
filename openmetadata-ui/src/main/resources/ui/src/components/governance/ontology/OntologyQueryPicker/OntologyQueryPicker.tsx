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
  FeaturedIcon,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Globe01, Search } from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  useOntologyConceptCounts,
  useOntologyPropertyCounts,
} from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { getEntityName } from '../../../../utils/EntityNameUtils';

interface OntologyQueryPickerProps {
  readonly ontologies: Ontology[];
  /** `ontology` is the Ontology view on All ontologies; the query surfaces pick what to query. */
  readonly surface: 'console' | 'builder' | 'ontology';
  readonly onSelect: (ontology: Ontology) => void;
}

const COUNT_SEPARATOR = ' · ';
// Counts cost one request per ontology, so only the first matching rows are counted.
const COUNTED_ROWS = 20;

/** All ontologies on a surface that reads one ontology: the user picks it here. */
const OntologyQueryPicker = ({
  ontologies,
  surface,
  onSelect,
}: OntologyQueryPickerProps) => {
  const { t } = useTranslation();
  const isOntologyView = surface === 'ontology';
  const [query, setQuery] = useState('');
  const countedOntologies = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();

    return ontologies
      .filter((ontology) =>
        getEntityName(ontology).toLocaleLowerCase().includes(needle)
      )
      .slice(0, COUNTED_ROWS);
  }, [ontologies, query]);
  const conceptCounts = useOntologyConceptCounts(countedOntologies, true);
  const propertyCounts = useOntologyPropertyCounts(countedOntologies, true);

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

  const items = ontologies.map((ontology) => ({
    id: ontology.id,
    label: getEntityName(ontology),
    supportingText: describeCounts(ontology) || undefined,
  }));

  return (
    <Box
      align="center"
      className="tw:w-full tw:px-6 tw:py-16"
      data-testid="ontology-query-picker"
      direction="col"
      gap={4}>
      <FeaturedIcon
        color="brand"
        icon={isOntologyView ? Globe01 : Search}
        size="lg"
        theme={isOntologyView ? 'modern' : 'light'}
      />
      <Box
        align="center"
        className="tw:max-w-105 tw:text-center"
        direction="col"
        gap={1}>
        <Typography
          as="h3"
          className="not-prose tw:m-0"
          data-testid="ontology-query-picker-title"
          size="text-md"
          weight="semibold">
          {t(
            isOntologyView
              ? 'message.ontology-choose-ontology-to-review'
              : 'message.query-choose-ontology-title'
          )}
        </Typography>
        <Typography
          color="secondary"
          data-testid="ontology-query-picker-description"
          size="text-sm">
          {t(
            isOntologyView
              ? 'message.ontology-view-works-on-one-ontology'
              : `message.query-choose-ontology-${surface}`
          )}
        </Typography>
      </Box>
      <Select.ComboBox
        aria-label={t('label.ontology')}
        className="tw:w-105 tw:max-w-full"
        data-testid="ontology-query-picker-select"
        items={items}
        label={isOntologyView ? undefined : t('label.ontology')}
        placeholder={
          isOntologyView
            ? t('label.search-entity', {
                entity: t('label.ontology-plural').toLocaleLowerCase(),
              })
            : t('label.select-entity', {
                entity: t('label.ontology').toLocaleLowerCase(),
              })
        }
        shortcut={false}
        size="md"
        onInputChange={setQuery}
        onSelectionChange={(key) => {
          const ontology = ontologies.find((item) => item.id === key);
          if (ontology) {
            onSelect(ontology);
          }
        }}>
        {(item) => (
          <Select.Item
            data-testid={`ontology-query-picker-option-${item.id}`}
            id={item.id}
            key={item.id}
            label={item.label}
            supportingText={item.supportingText}
          />
        )}
      </Select.ComboBox>
    </Box>
  );
};

export default OntologyQueryPicker;
