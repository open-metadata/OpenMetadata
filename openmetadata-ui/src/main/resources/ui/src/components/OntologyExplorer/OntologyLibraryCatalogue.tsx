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

import { Button, Card } from '@openmetadata/ui-core-components';
import { ArrowRight, ArrowUpRight, Check } from '@untitledui/icons';
import classNames from 'classnames';
import { KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { OntologyPackInstallation } from '../../generated/type/ontologyPackInstallation';
import { selectedModuleTotals } from './OntologyLibrary.utils';

interface OntologyLibraryCatalogueProps {
  installations: OntologyPackInstallation[];
  packs: OntologyPackManifest[];
  onSelect: (pack: OntologyPackManifest) => void;
}

const DEFAULT_PACK_ICON_CLASS = 'tw:bg-utility-gray-blue-600';
const INSTALLED_BADGE_CLASS =
  'tw:inline-flex tw:shrink-0 tw:items-center tw:gap-1 tw:rounded-full tw:border ' +
  'tw:border-utility-success-200 tw:bg-utility-success-50 tw:px-[7px] tw:py-0.5 ' +
  'tw:font-body tw:text-[9px] tw:leading-normal tw:font-semibold tw:text-utility-success-700';
const PACK_ICON_CLASSES: Record<string, string> = {
  epcis: 'tw:bg-utility-indigo-600',
  fhir: 'tw:bg-utility-green-600',
  fibo: 'tw:bg-brand-solid',
  gs1: 'tw:bg-utility-pink-600',
  'hr-open': 'tw:bg-utility-purple-600',
  'isa-95': 'tw:bg-utility-orange-600',
};

const OntologyLibraryCatalogue = ({
  installations,
  packs,
  onSelect,
}: OntologyLibraryCatalogueProps) => {
  const { t } = useTranslation();
  const [selectedFilterId, setSelectedFilterId] = useState<string>();
  const visiblePacks = selectedFilterId
    ? packs.filter((pack) => pack.id === selectedFilterId)
    : packs;

  const handleInstalledPackKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    pack: OntologyPackManifest
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(pack);
    }
  };

  return (
    <div data-testid="ontology-pack-catalogue">
      <div className="tw:mb-[18px] tw:flex tw:flex-wrap tw:gap-[7px]">
        <button
          aria-pressed={!selectedFilterId}
          className={classNames(
            'tw:rounded-full tw:border tw:px-[13px] tw:py-1.5 tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold',
            'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600',
            selectedFilterId
              ? 'tw:border-secondary tw:bg-primary tw:text-secondary'
              : 'tw:border-utility-brand-200 tw:bg-brand-primary tw:text-brand-secondary'
          )}
          data-testid="ontology-library-filter-all"
          type="button"
          onClick={() => setSelectedFilterId(undefined)}>
          {t('label.all')}
        </button>
        {packs.map((pack) => {
          const isSelected = selectedFilterId === pack.id;

          return (
            <button
              aria-pressed={isSelected}
              className={classNames(
                'tw:rounded-full tw:border tw:px-[13px] tw:py-1.5 tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold',
                'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600',
                isSelected
                  ? 'tw:border-utility-brand-200 tw:bg-brand-primary tw:text-brand-secondary'
                  : 'tw:border-secondary tw:bg-primary tw:text-secondary'
              )}
              data-testid={`ontology-library-filter-${pack.id}`}
              key={pack.id}
              type="button"
              onClick={() => setSelectedFilterId(pack.id)}>
              {pack.name}
            </button>
          );
        })}
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:lg:grid-cols-3">
        {visiblePacks.map((pack) => {
          const installation = installations.find(
            (candidate) => candidate.packId === pack.id
          );
          const isInstalledBundledPack = Boolean(installation && pack.bundled);
          const totals = selectedModuleTotals(
            pack,
            pack.modules.map((module) => module.id)
          );

          return (
            <Card
              className="tw:flex tw:flex-col tw:gap-[11px] tw:p-4 tw:shadow-xs"
              data-testid={`ontology-pack-${pack.id}`}
              isClickable={isInstalledBundledPack}
              key={pack.id}
              role={isInstalledBundledPack ? 'button' : undefined}
              tabIndex={isInstalledBundledPack ? 0 : undefined}
              onClick={
                isInstalledBundledPack ? () => onSelect(pack) : undefined
              }
              onKeyDown={
                isInstalledBundledPack
                  ? (event) => handleInstalledPackKeyDown(event, pack)
                  : undefined
              }>
              <div className="tw:flex tw:items-center tw:gap-[11px]">
                <span
                  className={classNames(
                    'tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-[10px] tw:px-1',
                    'tw:text-center tw:font-body tw:text-[11px] tw:leading-none tw:font-bold tw:tracking-[-0.02em] tw:text-white',
                    PACK_ICON_CLASSES[pack.id] ?? DEFAULT_PACK_ICON_CLASS
                  )}
                  data-testid={`ontology-pack-abbreviation-${pack.id}`}>
                  {pack.abbreviation}
                </span>
                <div className="tw:min-w-0 tw:flex-1">
                  <h2 className="tw:m-0 tw:truncate tw:font-body tw:text-sm tw:leading-normal tw:font-semibold tw:text-primary">
                    {pack.name}
                  </h2>
                  <p className="tw:m-0 tw:truncate tw:font-body tw:text-[11px] tw:leading-normal tw:font-normal tw:text-quaternary">
                    {pack.standard}
                  </p>
                </div>
                {installation ? (
                  <span className={INSTALLED_BADGE_CLASS}>
                    <Check aria-hidden="true" className="tw:size-2.5" />
                    {t('label.installed')}
                  </span>
                ) : null}
              </div>

              <p className="tw:m-0 tw:line-clamp-2 tw:min-h-9 tw:font-body tw:text-xs tw:leading-[18px] tw:font-normal tw:text-tertiary">
                {pack.description}
              </p>

              <div className="tw:mt-auto tw:flex tw:items-center tw:gap-2 tw:pt-0.5">
                <span className="tw:font-body tw:text-[11px] tw:leading-normal tw:font-medium tw:text-quaternary">
                  {totals.concepts}{' '}
                  {t('label.concept-plural').toLocaleLowerCase()}{' '}
                  <span aria-hidden="true">·</span> {totals.relationships}{' '}
                  {t('label.relation-plural').toLocaleLowerCase()}
                </span>
                <span className="tw:flex-1" />
                {!installation && pack.bundled ? (
                  <Button
                    className="tw:gap-1! tw:text-[11px]! tw:font-semibold!"
                    color="link-color"
                    data-testid={`ontology-pack-details-${pack.id}`}
                    iconTrailing={
                      <ArrowRight className="tw:size-3 tw:text-fg-brand-primary" />
                    }
                    size="xs"
                    onPress={() => onSelect(pack)}>
                    {t('label.install')}
                  </Button>
                ) : !installation ? (
                  <Button
                    className="tw:gap-1! tw:text-[11px]! tw:font-semibold!"
                    color="link-color"
                    data-testid={`ontology-pack-source-${pack.id}`}
                    href={pack.sourceUrl}
                    iconTrailing={
                      <ArrowUpRight className="tw:size-3 tw:text-fg-brand-primary" />
                    }
                    rel="noreferrer"
                    size="xs"
                    target="_blank">
                    {t('label.source')}
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default OntologyLibraryCatalogue;
