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
  Check,
  ChevronDown,
  Globe01,
  Plus,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyConceptCounts } from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { useIsAiMode } from '../../../../hooks/useAppMode';
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
  readonly onEditOntology?: () => void;
  readonly onOpenChange?: (isOpen: boolean) => void;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
}

const SECTION_HEADER_CLASS =
  'tw:px-4 tw:pt-2 tw:pb-1 tw:text-xs tw:font-semibold tw:tracking-wide tw:text-tertiary tw:uppercase';
const RETRY_SCOPE_LOAD_KEY = 'retry-scope-load';

const renderAiItemContent =
  (name: string, meta?: string) =>
  ({ isSelected }: { isSelected: boolean }) =>
    (
      <span className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-3">
        <span className="tw:min-w-0 tw:flex-1 tw:truncate">{name}</span>
        {meta ? (
          <span className="tw:shrink-0 tw:text-xs tw:text-tertiary">
            {meta}
          </span>
        ) : null}
        {isSelected ? (
          <Check aria-hidden="true" className="tw:size-4 tw:shrink-0" />
        ) : null}
      </span>
    );

const OntologyStudioScopeMenu = ({
  scope,
  label,
  ontologies,
  glossaries,
  onScopeChange,
  onCreateOntology,
  onEditOntology,
  onOpenChange,
  isLoading,
  isError,
  onRetry,
}: OntologyStudioScopeMenuProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [isOpen, setIsOpen] = useState(false);
  const conceptCounts = useOntologyConceptCounts(ontologies, isOpen);
  const termLabel = t('label.term-plural').toLocaleLowerCase();
  const conceptLabel = t('label.concept-plural').toLocaleLowerCase();

  const handleAction = (key: string) => {
    if (key === 'edit-ontology') {
      onEditOntology?.();

      return;
    }
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

  const loadingItem = isLoading ? (
    <Dropdown.Item
      isDisabled
      id="scope-loading"
      label={t('label.loading')}
      textValue={t('label.loading')}
    />
  ) : null;
  const errorSection = isError ? (
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
  ) : null;

  const renderAiMenuItems = (): ReactNode => {
    const allOntologiesLabel = t('label.all-entity', {
      entity: t('label.ontology-plural').toLocaleLowerCase(),
    });
    const newOntologyLabel = t('label.new-entity', {
      entity: t('label.ontology'),
    });
    const isGlossaryScope = scope.kind === 'glossaries';

    return (
      <>
        {loadingItem}
        {errorSection}
        <Dropdown.Section id="ontologies">
          {isGlossaryScope ? (
            <Dropdown.SectionHeader className={SECTION_HEADER_CLASS}>
              {t('label.ontology-plural')}
            </Dropdown.SectionHeader>
          ) : null}
          <Dropdown.Item
            data-testid="ontology-scope-all-ontologies"
            id={ALL_ONTOLOGIES_SCOPE_KEY}
            textValue={allOntologiesLabel}>
            {renderAiItemContent(allOntologiesLabel)}
          </Dropdown.Item>
          {ontologies.map((ontology) => {
            const name = getEntityName(ontology);
            const count = conceptCounts[ontology.id];

            return (
              <Dropdown.Item
                data-testid={`ontology-scope-${ontology.id}`}
                id={`ontology:${ontology.id}`}
                key={ontology.id}
                textValue={name}>
                {renderAiItemContent(
                  name,
                  count === undefined ? undefined : `${count} ${conceptLabel}`
                )}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Section>
        {isGlossaryScope ? (
          <>
            <Dropdown.Separator />
            <Dropdown.Section id="glossaries">
              <Dropdown.SectionHeader className={SECTION_HEADER_CLASS}>
                {t('label.glossary-plural')}
              </Dropdown.SectionHeader>
              <Dropdown.Item
                data-testid="ontology-scope-all-glossaries"
                id={ALL_GLOSSARIES_SCOPE_KEY}
                textValue={t('label.all-glossaries')}>
                {renderAiItemContent(
                  t('label.all-glossaries'),
                  `${glossaries.length} ${t(
                    'label.glossary-plural'
                  ).toLocaleLowerCase()}`
                )}
              </Dropdown.Item>
              {glossaries.map((glossary) => {
                const name = getEntityName(glossary);

                return (
                  <Dropdown.Item
                    data-testid={glossary.id}
                    id={`glossary:${glossary.id}`}
                    key={glossary.id}
                    textValue={name}>
                    {renderAiItemContent(
                      name,
                      `${glossary.termCount ?? 0} ${termLabel}`
                    )}
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Section>
          </>
        ) : null}
        {onCreateOntology ? (
          <>
            <Dropdown.Separator />
            <Dropdown.Item
              data-testid="ontology-create"
              id={NEW_ONTOLOGY_SCOPE_KEY}
              textValue={newOntologyLabel}>
              <span className="tw:flex tw:items-center tw:gap-2 tw:font-semibold">
                <Plus aria-hidden="true" className="tw:size-4 tw:shrink-0" />
                {newOntologyLabel}
              </span>
            </Dropdown.Item>
          </>
        ) : null}
      </>
    );
  };

  return (
    <Dropdown.Root onOpenChange={handleOpenChange}>
      <Button
        ellipsis
        className="tw:min-w-0 tw:max-w-full"
        color="secondary"
        data-scope-key={getScopeKey(scope)}
        data-testid="ontology-scope-menu-trigger"
        iconLeading={Globe01}
        iconTrailing={ChevronDown}
        size="sm">
        <span className="tw:truncate">{label}</span>
      </Button>
      <Dropdown.Popover
        className={isAiMode ? 'tw:w-80' : 'tw:w-72'}
        placement="bottom left">
        <Dropdown.Menu
          aria-label={t('label.ontology-plural')}
          className="tw:max-h-96"
          selectedKeys={new Set([getScopeKey(scope)])}
          onAction={(key) => handleAction(String(key))}>
          {isAiMode ? (
            renderAiMenuItems()
          ) : (
            <>
              {loadingItem}
              {errorSection}
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
                        count === undefined
                          ? undefined
                          : `${count} ${conceptLabel}`
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
                    label={t('label.new-entity', {
                      entity: t('label.ontology'),
                    })}
                    textValue={t('label.new-entity', {
                      entity: t('label.ontology'),
                    })}
                  />
                ) : null}
              </Dropdown.Section>
              {onEditOntology ? (
                <Dropdown.Item
                  data-testid="ontology-edit-ontology"
                  id="edit-ontology"
                  label={t('label.edit-entity', {
                    entity: t('label.ontology'),
                  })}
                />
              ) : null}
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
            </>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default OntologyStudioScopeMenu;
