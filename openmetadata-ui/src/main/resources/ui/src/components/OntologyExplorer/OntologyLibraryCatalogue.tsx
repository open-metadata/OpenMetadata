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
  Card,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ArrowUpRight,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode, useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { selectedModuleTotals } from './OntologyLibrary.utils';

interface OntologyLibraryCatalogueProps {
  packs: OntologyPackManifest[];
  onSelect: (pack: OntologyPackManifest) => void;
}

const ALL_FILTER_ID = 'all';
const PACK_CARD_SPAN = 12;
const DEFAULT_PACK_ICON_CLASS = 'tw:bg-utility-gray-blue-600';
const PACK_ICON_CLASSES: Record<string, string> = {
  epcis: 'tw:bg-utility-indigo-600',
  fhir: 'tw:bg-utility-green-600',
  fibo: 'tw:bg-brand-solid',
  gs1: 'tw:bg-utility-pink-600',
  'hr-open': 'tw:bg-utility-purple-600',
  'isa-95': 'tw:bg-utility-orange-600',
};

export const OntologyPackIcon = ({ pack }: { pack: OntologyPackManifest }) => (
  <Box
    align="center"
    className={classNames(
      'tw:size-10 tw:shrink-0 tw:rounded-lg tw:px-1 tw:text-center',
      PACK_ICON_CLASSES[pack.id] ?? DEFAULT_PACK_ICON_CLASS
    )}
    data-testid={`ontology-pack-abbreviation-${pack.id}`}
    justify="center">
    <Typography
      className="tw:text-primary_on-brand"
      size="text-xs"
      weight="bold">
      {pack.abbreviation}
    </Typography>
  </Box>
);

interface OntologyPackCardProps {
  pack: OntologyPackManifest;
  onSelect: (pack: OntologyPackManifest) => void;
}

const OntologyPackCard = ({ pack, onSelect }: OntologyPackCardProps) => {
  const { t } = useTranslation();
  const totals = selectedModuleTotals(
    pack,
    pack.modules.map((module) => module.id)
  );

  let action: ReactNode = null;
  if (pack.bundled) {
    action = (
      <Button
        color="link-color"
        data-testid={`ontology-pack-details-${pack.id}`}
        iconTrailing={ArrowRight}
        size="sm"
        onPress={() => onSelect(pack)}>
        {t('label.install')}
      </Button>
    );
  } else {
    action = (
      <Button
        color="link-color"
        data-testid={`ontology-pack-source-${pack.id}`}
        href={pack.sourceUrl}
        iconTrailing={ArrowUpRight}
        rel="noreferrer"
        size="sm"
        target="_blank">
        {t('label.source')}
      </Button>
    );
  }

  return (
    <Card
      className="tw:flex tw:h-full tw:flex-col tw:gap-3 tw:p-4"
      data-testid={`ontology-pack-${pack.id}`}>
      <Box align="center" gap={3}>
        <OntologyPackIcon pack={pack} />
        <Box className="tw:min-w-0" direction="col">
          <Typography
            ellipsis
            aria-level={3}
            className="tw:text-primary"
            role="heading"
            size="text-md"
            weight="medium">
            {pack.name}
          </Typography>
          <Typography ellipsis className="tw:text-tertiary" size="text-sm">
            {pack.standard}
          </Typography>
        </Box>
      </Box>

      <Typography
        className="tw:text-secondary"
        ellipsis={{ rows: 2 }}
        size="text-sm">
        {pack.description}
      </Typography>

      <Box align="center" className="tw:mt-auto" gap={2} justify="between">
        <Typography className="tw:text-tertiary" size="text-sm">
          {totals.concepts} {t('label.concept-plural').toLocaleLowerCase()} ·{' '}
          {totals.relationships}{' '}
          {t('label.relation-plural').toLocaleLowerCase()}
        </Typography>
        {action}
      </Box>
    </Card>
  );
};

const OntologyLibraryCatalogue = ({
  packs,
  onSelect,
}: OntologyLibraryCatalogueProps) => {
  const { t } = useTranslation();
  const [selectedFilterId, setSelectedFilterId] = useState(ALL_FILTER_ID);
  const filters = [
    { id: ALL_FILTER_ID, label: t('label.all') },
    ...packs.map((pack) => ({ id: pack.id, label: pack.name })),
  ];
  const visiblePacks =
    selectedFilterId === ALL_FILTER_ID
      ? packs
      : packs.filter((pack) => pack.id === selectedFilterId);

  return (
    <Box data-testid="ontology-pack-catalogue" direction="col" gap={4}>
      <ToggleButtonGroup
        disallowEmptySelection
        aria-label={t('label.filter')}
        className="tw:flex tw:flex-wrap tw:gap-2"
        selectedKeys={[selectedFilterId]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [key] = keys;
          setSelectedFilterId(String(key));
        }}>
        {filters.map((filter) => (
          <ToggleButton
            className="tw:cursor-pointer tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2"
            data-testid={`ontology-library-filter-${filter.id}`}
            id={filter.id}
            key={filter.id}>
            <Badge
              color={filter.id === selectedFilterId ? 'blue' : 'gray'}
              size="md"
              type="color">
              {filter.label}
            </Badge>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Grid gap="4">
        {visiblePacks.map((pack) => (
          <Grid.Item key={pack.id} span={PACK_CARD_SPAN}>
            <OntologyPackCard pack={pack} onSelect={onSelect} />
          </Grid.Item>
        ))}
      </Grid>
    </Box>
  );
};

export default OntologyLibraryCatalogue;
