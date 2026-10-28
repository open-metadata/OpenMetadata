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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import {
  BookClosed,
  ChevronDown,
  Globe01,
  Plus,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyConceptCounts } from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  ALL_GLOSSARIES_SCOPE_KEY,
  ALL_ONTOLOGIES_SCOPE_KEY,
  getScopeKey,
  NEW_ONTOLOGY_SCOPE_KEY,
  OntologyStudioScope,
  parseScopeKey,
} from '../../../../utils/governance/ontology/OntologyStudioScope.utils';

interface OntologyStudioScopeMenuProps {
  readonly scope: OntologyStudioScope;
  readonly label: string;
  readonly ontologies: Ontology[];
  readonly glossaries: Glossary[];
  readonly onScopeChange: (scope: OntologyStudioScope) => void;
  readonly onCreateOntology?: () => void;
  readonly onOpenChange?: (isOpen: boolean) => void;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
}

const SECTION_HEADER_CLASS =
  'tw:px-4 tw:pt-2 tw:pb-1 tw:text-xs tw:font-semibold tw:tracking-wide tw:text-tertiary tw:uppercase';
const RETRY_SCOPE_LOAD_KEY = 'retry-scope-load';

const OntologyStudioScopeMenu = ({
  scope,
  label,
  ontologies,
  glossaries,
  onScopeChange,
  onCreateOntology,
  onOpenChange,
  isLoading,
  isError,
  onRetry,
}: OntologyStudioScopeMenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const conceptCounts = useOntologyConceptCounts(ontologies, isOpen);
  const termLabel = t('label.term-plural').toLocaleLowerCase();
  const conceptLabel = t('label.concept-plural').toLocaleLowerCase();

  const handleAction = (key: string) => {
    if (key === RETRY_SCOPE_LOAD_KEY) {
      onRetry?.();

      return;
    }
    if (key === NEW_ONTOLOGY_SCOPE_KEY) {
      onCreateOntology?.();

      return;
    }
    const next = parseScopeKey(key);
    if (next) {
      onScopeChange(next);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  return (
    <Dropdown.Root onOpenChange={handleOpenChange}>
      <Button
        className="tw:max-w-64 tw:shrink-0"
        color="secondary"
        data-scope-key={getScopeKey(scope)}
        data-testid="ontology-scope-menu-trigger"
        iconLeading={Globe01}
        iconTrailing={ChevronDown}
        size="sm">
        <span className="tw:truncate">{label}</span>
      </Button>
      <Dropdown.Popover className="tw:w-72" placement="bottom left">
        <Dropdown.Menu
          aria-label={t('label.ontology-plural')}
          className="tw:max-h-96"
          selectedKeys={new Set([getScopeKey(scope)])}
          onAction={(key) => handleAction(String(key))}>
          {isLoading ? (
            <Dropdown.Item
              isDisabled
              id="scope-loading"
              label={t('label.loading')}
              textValue={t('label.loading')}
            />
          ) : null}
          {isError ? (
            <Dropdown.Section id="scope-error">
              <Dropdown.Item
                isDisabled
                id="scope-load-error"
                label={t('message.temporary-error-try-reloading')}
                textValue={t('message.temporary-error-try-reloading')}
              />
              <Dropdown.Item
                id={RETRY_SCOPE_LOAD_KEY}
                label={t('label.retry')}
                textValue={t('label.retry')}
              />
            </Dropdown.Section>
          ) : null}
          <Dropdown.Section id="ontologies">
            <Dropdown.SectionHeader className={SECTION_HEADER_CLASS}>
              {t('label.ontology-plural')}
            </Dropdown.SectionHeader>
            <Dropdown.Item
              data-testid="ontology-scope-all-ontologies"
              icon={Globe01}
              id={ALL_ONTOLOGIES_SCOPE_KEY}
              label={t('label.all-entity', {
                entity: t('label.ontology-plural').toLocaleLowerCase(),
              })}
              textValue={t('label.all-entity', {
                entity: t('label.ontology-plural').toLocaleLowerCase(),
              })}
            />
            {ontologies.map((ontology) => {
              const name = getEntityName(ontology);
              const count = conceptCounts[ontology.id];

              return (
                <Dropdown.Item
                  addon={
                    count === undefined ? undefined : `${count} ${conceptLabel}`
                  }
                  data-testid={`ontology-scope-${ontology.id}`}
                  icon={Globe01}
                  id={`ontology:${ontology.id}`}
                  key={ontology.id}
                  label={name}
                  textValue={name}
                />
              );
            })}
            {onCreateOntology ? (
              <Dropdown.Item
                data-testid="ontology-create"
                icon={Plus}
                id={NEW_ONTOLOGY_SCOPE_KEY}
                label={t('label.new-entity', { entity: t('label.ontology') })}
                textValue={t('label.new-entity', {
                  entity: t('label.ontology'),
                })}
              />
            ) : null}
          </Dropdown.Section>
          {scope.kind === 'glossaries' ? (
            <>
              <Dropdown.Separator />
              <Dropdown.Section id="glossaries">
                <Dropdown.SectionHeader className={SECTION_HEADER_CLASS}>
                  {t('label.glossary-plural')}
                </Dropdown.SectionHeader>
                <Dropdown.Item
                  addon={`${glossaries.length} ${t(
                    'label.glossary-plural'
                  ).toLocaleLowerCase()}`}
                  data-testid="ontology-scope-all-glossaries"
                  icon={BookClosed}
                  id={ALL_GLOSSARIES_SCOPE_KEY}
                  label={t('label.all-glossaries')}
                  textValue={t('label.all-glossaries')}
                />
                {glossaries.map((glossary) => {
                  const name = getEntityName(glossary);

                  return (
                    <Dropdown.Item
                      addon={`${glossary.termCount ?? 0} ${termLabel}`}
                      data-testid={glossary.id}
                      icon={BookClosed}
                      id={`glossary:${glossary.id}`}
                      key={glossary.id}
                      label={name}
                      textValue={name}
                    />
                  );
                })}
              </Dropdown.Section>
            </>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default OntologyStudioScopeMenu;
