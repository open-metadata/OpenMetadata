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
  BadgeWithIcon,
  Box,
  Button,
  Card,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { selectedModuleTotals } from './OntologyLibrary.utils';
import {
  INDUSTRY_LABEL_KEY,
  INDUSTRY_ORDER,
  PACK_PRESENTATION,
} from './OntologyLibraryCatalogue.constants';

interface OntologyLibraryCatalogueProps {
  packs: OntologyPackManifest[];
  installedPackIds?: string[];
  onSelect: (pack: OntologyPackManifest) => void;
}

const ALL_FILTER_ID = 'all';
const DEFAULT_PACK_ICON_CLASS =
  'tw:bg-utility-gray-blue-700 tw:text-utility-gray-blue-50';

export const OntologyPackIcon = ({ pack }: { pack: OntologyPackManifest }) => (
  <span
    className={`tw:inline-flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:text-center tw:text-xs tw:font-bold tw:whitespace-nowrap ${
      PACK_PRESENTATION[pack.id]?.iconClass ?? DEFAULT_PACK_ICON_CLASS
    }`}
    data-testid={`ontology-pack-abbreviation-${pack.id}`}>
    {PACK_PRESENTATION[pack.id]?.mark ?? pack.abbreviation}
  </span>
);

interface OntologyPackCardProps {
  pack: OntologyPackManifest;
  installed?: boolean;
  onSelect: (pack: OntologyPackManifest) => void;
}

const OntologyPackCard = ({
  pack,
  installed,
  onSelect,
}: OntologyPackCardProps) => {
  const { t } = useTranslation();
  const totals = selectedModuleTotals(
    pack,
    pack.modules.map((module) => module.id)
  );
  const presentation = PACK_PRESENTATION[pack.id];

  let action: ReactNode = null;
  if (pack.bundled) {
    action = (
      <Button
        aria-label={`${t('label.view')} ${pack.name}`}
        className="tw:static! tw:after:absolute tw:after:inset-0 tw:after:pointer-events-auto! tw:focus-visible:after:outline-2 tw:focus-visible:after:outline-focus-ring"
        color="link-color"
        data-testid={`ontology-pack-details-${pack.id}`}
        iconTrailing={ArrowRight}
        size="sm"
        onPress={() => onSelect(pack)}>
        {t(installed ? 'label.view' : 'label.install')}
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
      className="tw:relative tw:h-full"
      data-testid={`ontology-pack-${pack.id}`}
      size="md"
      variant="elevated">
      <Card.Content className="tw:h-full">
        <Box className="tw:h-full" direction="col" gap={3}>
          <Box align="center" gap={3}>
            <OntologyPackIcon pack={pack} />
            <Box className="tw:min-w-0 tw:flex-1" direction="col">
              <Box align="center" gap={2} justify="between" wrap="wrap">
                <Typography
                  aria-level={3}
                  role="heading"
                  size="text-md"
                  weight="semibold">
                  {presentation ? t(presentation.titleKey) : pack.name}
                </Typography>
                {installed && (
                  <BadgeWithIcon
                    color="success"
                    iconLeading={Check}
                    size="sm"
                    type="pill-color">
                    {t('label.installed')}
                  </BadgeWithIcon>
                )}
              </Box>
              <Typography ellipsis color="secondary" size="text-sm">
                {pack.standard}
              </Typography>
            </Box>
          </Box>

          <Typography color="secondary" size="text-sm">
            {pack.description}
          </Typography>

          <Box align="center" className="tw:mt-auto" gap={2} justify="between">
            <Typography color="secondary" size="text-sm">
              {totals.concepts} {t('label.concept-plural').toLocaleLowerCase()}{' '}
              · {totals.relationships}{' '}
              {t('label.relation-plural').toLocaleLowerCase()}
            </Typography>
            {action}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};

const OntologyLibraryCatalogue = ({
  packs,
  installedPackIds = [],
  onSelect,
}: OntologyLibraryCatalogueProps) => {
  const { t } = useTranslation();
  const [selectedFilterId, setSelectedFilterId] = useState(ALL_FILTER_ID);
  const orderedPacks = [...packs].sort(
    (a, b) =>
      (PACK_PRESENTATION[a.id]?.order ?? Number.MAX_SAFE_INTEGER) -
      (PACK_PRESENTATION[b.id]?.order ?? Number.MAX_SAFE_INTEGER)
  );
  const filters = [
    { id: ALL_FILTER_ID, label: t('label.all') },
    ...INDUSTRY_ORDER.filter((industry) =>
      orderedPacks.some((pack) => pack.industry === industry)
    ).map((industry) => ({
      id: industry,
      label: t(INDUSTRY_LABEL_KEY[industry]),
    })),
  ];
  const visiblePacks =
    selectedFilterId === ALL_FILTER_ID
      ? orderedPacks
      : orderedPacks.filter((pack) => pack.industry === selectedFilterId);

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
              size="lg"
              type="pill-color">
              {filter.label}
            </Badge>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Grid className="tw:md:gap-x-4" colGap="0" rowGap="4">
        {visiblePacks.map((pack) => (
          <Grid.Item
            className="tw:md:col-span-12 tw:lg:col-span-8"
            key={pack.id}>
            <OntologyPackCard
              installed={installedPackIds.includes(pack.id)}
              pack={pack}
              onSelect={onSelect}
            />
          </Grid.Item>
        ))}
      </Grid>
    </Box>
  );
};

export default OntologyLibraryCatalogue;
