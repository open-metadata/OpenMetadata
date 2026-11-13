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
  Button,
  ButtonUtility,
  Dropdown,
  Input,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import {
  BookClosed,
  Check,
  ChevronDown,
  DotsHorizontal,
  Globe01,
  Plus,
  Search,
} from '@openmetadata/ui-core-components/icons';
import { useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { ButtonHTMLAttributes, ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY,
  useOntologyConceptCounts,
} from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  ALL_GLOSSARIES_SCOPE_KEY,
  ALL_ONTOLOGIES_SCOPE_KEY,
  getScopeKey,
  OntologyStudioScope,
} from '../../../../utils/governance/ontology/OntologyStudioScope.utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyDeleteDialog from '../OntologyDeleteDialog/OntologyDeleteDialog';
import { filterOntologies } from './OntologyStudioScopeMenu.utils';

interface OntologyStudioScopeMenuProps {
  readonly scope: OntologyStudioScope;
  readonly label: string;
  readonly ontologies: Ontology[];
  readonly glossaries: Glossary[];
  readonly onScopeChange: (scope: OntologyStudioScope) => void;
  readonly onCreateOntology?: () => void;
  readonly onEditOntology?: () => void;
  readonly onOpenSettings?: (ontology: Ontology) => void;
  readonly onOntologyDeleted?: (ontology: Ontology) => void;
  readonly onOpenChange?: (isOpen: boolean) => void;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
}

const ROWS_PER_PAGE = 20;
const SECTION_HEADER_CLASS =
  'tw:px-4 tw:pt-2 tw:pb-1 tw:text-xs tw:font-semibold tw:tracking-wide tw:text-tertiary tw:uppercase';
const ROW_CLASS = [
  'tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-3',
  'tw:rounded-md tw:border-0 tw:bg-transparent tw:px-3 tw:py-2 tw:text-left',
  'tw:text-sm tw:text-primary tw:outline-focus-ring tw:focus-visible:outline-2',
].join(' ');

// react-aria's Button drops `role`; the picker keeps the menu roles it had as a Dropdown.Menu.
const MenuButton = ({
  children,
  onPress,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  readonly onPress: () => void;
  readonly 'data-testid': string;
}) => (
  <button
    {...rest}
    className={classNames(ROW_CLASS, className)}
    type="button"
    onClick={onPress}>
    {children}
  </button>
);

interface RowActionsProps {
  readonly ontology: Ontology;
  readonly onSettings: (ontology: Ontology) => void;
  readonly onDelete: (ontology: Ontology) => void;
}

// Permissions load on first open: one lookup per row would cost a request per ontology.
const OntologyRowActions = ({
  ontology,
  onSettings,
  onDelete,
}: RowActionsProps) => {
  const { t } = useTranslation();
  const [isRequested, setIsRequested] = useState(false);
  const { canEditAll, canDelete } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology.id },
    { enabled: isRequested, deleted: ontology.deleted }
  );

  return (
    <Dropdown.Root onOpenChange={(open) => open && setIsRequested(true)}>
      {/* Shown on row hover or focus, as the design's picker does; an open menu keeps it shown. */}
      <ButtonUtility
        aria-label={t('label.more-actions-for', {
          name: getEntityName(ontology),
        })}
        className="tw:mr-1 tw:shrink-0 tw:opacity-0 tw:group-hover:opacity-100 tw:group-focus-within:opacity-100 tw:aria-expanded:opacity-100"
        data-testid={`ontology-scope-actions-${ontology.id}`}
        icon={DotsHorizontal}
        size="sm"
      />
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={t('label.more-actions')}
          onAction={(key) =>
            key === 'settings' ? onSettings(ontology) : onDelete(ontology)
          }>
          <Dropdown.Item
            data-testid={`ontology-scope-settings-${ontology.id}`}
            id="settings"
            isDisabled={!canEditAll}
            label={t('label.setting-plural')}
            textValue={t('label.setting-plural')}
          />
          <Dropdown.Item
            data-testid={`ontology-scope-delete-${ontology.id}`}
            id="delete"
            isDisabled={!canDelete}
            label={t('label.delete')}
            textValue={t('label.delete')}
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const OntologyStudioScopeMenu = ({
  scope,
  label,
  ontologies,
  glossaries,
  onScopeChange,
  onCreateOntology,
  onEditOntology,
  onOpenSettings,
  onOntologyDeleted,
  onOpenChange,
  isLoading,
  isError,
  onRetry,
}: OntologyStudioScopeMenuProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Ontology>();
  const [shown, setShown] = useState(ROWS_PER_PAGE);
  const matchingOntologies = useMemo(
    () => filterOntologies(ontologies, query),
    [ontologies, query]
  );
  const visibleOntologies = useMemo(
    () => matchingOntologies.slice(0, shown),
    [matchingOntologies, shown]
  );
  // Counts cost one request per row, so only the rows on screen are counted.
  const conceptCounts = useOntologyConceptCounts(visibleOntologies, isOpen);
  const termLabel = t('label.term-plural').toLocaleLowerCase();
  const selectedKey = getScopeKey(scope);
  const allOntologiesLabel = t('label.all-entity', {
    entity: t('label.ontology-plural').toLocaleLowerCase(),
  });
  const searchLabel = t('label.search-entity', {
    entity: t('label.ontology-plural').toLocaleLowerCase(),
  });
  const newOntologyLabel = t('label.new-entity', {
    entity: t('label.ontology').toLocaleLowerCase(),
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setQuery('');
    setShown(ROWS_PER_PAGE);
    onOpenChange?.(open);
  };

  const closeThen = (action?: () => void) => () => {
    handleOpenChange(false);
    action?.();
  };

  const renderRow = ({
    testId,
    scopeKey,
    name,
    meta,
    scopeTarget,
    icon,
    actions,
  }: {
    testId: string;
    scopeKey: string;
    name: string;
    meta?: string;
    scopeTarget: OntologyStudioScope;
    icon?: ReactNode;
    actions?: ReactNode;
  }) => {
    const isSelected = scopeKey === selectedKey;

    return (
      <li
        className={classNames(
          'tw:group tw:flex tw:items-center tw:rounded-md',
          isSelected ? 'tw:bg-brand-primary' : 'tw:hover:bg-primary_hover'
        )}
        key={scopeKey}
        role="none">
        <MenuButton
          aria-checked={isSelected}
          aria-label={meta ? `${name}, ${meta}` : name}
          className={isSelected ? 'tw:text-brand-secondary' : undefined}
          data-testid={testId}
          role="menuitemradio"
          onPress={closeThen(() => onScopeChange(scopeTarget))}>
          {icon}
          <span
            className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-medium"
            data-testid={`${testId}-label`}>
            {name}
          </span>
          {meta ? (
            <span className="tw:shrink-0 tw:text-xs tw:text-tertiary">
              {meta}
            </span>
          ) : null}
          {isSelected ? (
            <Check
              aria-hidden="true"
              className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
            />
          ) : null}
        </MenuButton>
        {actions}
      </li>
    );
  };

  const renderOntologyRows = () =>
    visibleOntologies.map((ontology) => {
      const count = conceptCounts[ontology.id];

      return renderRow({
        testId: `ontology-scope-${ontology.id}`,
        scopeKey: `ontology:${ontology.id}`,
        name: getEntityName(ontology),
        meta:
          count === undefined
            ? undefined
            : t('message.native-concept-count', { count }),
        scopeTarget: { kind: 'ontology', ontologyId: ontology.id },
        icon: isAiMode ? undefined : (
          <Globe01 aria-hidden="true" className="tw:size-4 tw:shrink-0" />
        ),
        actions: (
          <OntologyRowActions
            ontology={ontology}
            onDelete={(target) => {
              handleOpenChange(false);
              setPendingDelete(target);
            }}
            onSettings={(target) => {
              handleOpenChange(false);
              onOpenSettings?.(target);
            }}
          />
        ),
      });
    });

  const renderGlossaryRows = () => (
    <>
      <div className={SECTION_HEADER_CLASS}>{t('label.glossary-plural')}</div>
      <ul className="tw:m-0 tw:list-none tw:p-0" role="none">
        {renderRow({
          testId: 'ontology-scope-all-glossaries',
          scopeKey: ALL_GLOSSARIES_SCOPE_KEY,
          name: t('label.all-glossaries'),
          meta: `${glossaries.length} ${t(
            'label.glossary-plural'
          ).toLocaleLowerCase()}`,
          scopeTarget: { kind: 'glossaries' },
          icon: isAiMode ? undefined : (
            <BookClosed aria-hidden="true" className="tw:size-4 tw:shrink-0" />
          ),
        })}
        {glossaries.map((glossary) =>
          renderRow({
            testId: glossary.id,
            scopeKey: `glossary:${glossary.id}`,
            name: getEntityName(glossary),
            meta: `${glossary.termCount ?? 0} ${termLabel}`,
            scopeTarget: { kind: 'glossaries', glossaryId: glossary.id },
            icon: isAiMode ? undefined : (
              <BookClosed
                aria-hidden="true"
                className="tw:size-4 tw:shrink-0"
              />
            ),
          })
        )}
      </ul>
    </>
  );

  const renderStatus = () => (
    <>
      {isLoading ? (
        <div className="tw:px-4 tw:py-2">
          <Loader size="small" />
        </div>
      ) : null}
      {isError ? (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:px-4 tw:py-2 tw:text-sm tw:text-tertiary">
          {t('message.temporary-error-try-reloading')}
          <Button
            color="secondary"
            size="xs"
            onPress={closeThen(() => onRetry?.())}>
            {t('label.retry')}
          </Button>
        </div>
      ) : null}
    </>
  );

  const renderFooter = () => (
    <>
      {onEditOntology && !isAiMode ? (
        <MenuButton
          className="tw:mx-1 tw:flex-none"
          data-testid="ontology-edit-ontology"
          role="menuitem"
          onPress={closeThen(onEditOntology)}>
          {t('label.edit-entity', { entity: t('label.ontology') })}
        </MenuButton>
      ) : null}
      {onCreateOntology ? (
        <div className="tw:mt-1 tw:border-t tw:border-secondary tw:px-1 tw:pt-1">
          <MenuButton
            className="tw:w-full tw:font-medium tw:text-brand-secondary"
            data-testid="ontology-create"
            role="menuitem"
            onPress={closeThen(onCreateOntology)}>
            <Plus aria-hidden="true" className="tw:size-4 tw:shrink-0" />
            {newOntologyLabel}
          </MenuButton>
        </div>
      ) : null}
    </>
  );

  const renderPanel = () => (
    <div
      aria-label={t('label.ontology-plural')}
      className="tw:flex tw:max-h-96 tw:flex-col tw:py-2"
      role="menu">
      {renderStatus()}
      <div className="tw:px-3 tw:pb-2">
        <Input
          aria-label={searchLabel}
          icon={Search}
          inputDataTestId="ontology-scope-search"
          placeholder={searchLabel}
          size="sm"
          value={query}
          onChange={setQuery}
        />
      </div>
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-1">
        {scope.kind === 'glossaries' ? (
          <div className={SECTION_HEADER_CLASS}>
            {t('label.ontology-plural')}
          </div>
        ) : null}
        <ul className="tw:m-0 tw:list-none tw:p-0" role="none">
          {query.trim()
            ? null
            : renderRow({
                testId: 'ontology-scope-all-ontologies',
                scopeKey: ALL_ONTOLOGIES_SCOPE_KEY,
                name: allOntologiesLabel,
                meta: `${ontologies.length} ${t(
                  'label.ontology-plural'
                ).toLocaleLowerCase()}`,
                scopeTarget: { kind: 'allOntologies' },
                icon: isAiMode ? undefined : (
                  <Globe01
                    aria-hidden="true"
                    className="tw:size-4 tw:shrink-0"
                  />
                ),
              })}
          {renderOntologyRows()}
        </ul>
        {matchingOntologies.length > shown ? (
          <MenuButton
            className="tw:w-full tw:justify-center tw:text-tertiary"
            data-testid="ontology-scope-show-more"
            role="menuitem"
            onPress={() => setShown((count) => count + ROWS_PER_PAGE)}>
            {t('label.show-more')}
          </MenuButton>
        ) : null}
        {query.trim() && matchingOntologies.length === 0 ? (
          <div
            className="tw:px-4 tw:py-2 tw:text-sm tw:text-tertiary"
            data-testid="ontology-scope-no-match">
            {t('message.ontology-picker-no-match', { query: query.trim() })}
          </div>
        ) : null}
        {scope.kind === 'glossaries' && !query.trim()
          ? renderGlossaryRows()
          : null}
      </div>
      {renderFooter()}
    </div>
  );

  return (
    <>
      <PopoverTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Button
          ellipsis
          className="tw:min-w-0 tw:max-w-full"
          color="secondary"
          data-scope-key={selectedKey}
          data-testid="ontology-scope-menu-trigger"
          iconLeading={Globe01}
          iconTrailing={ChevronDown}
          size="sm">
          <span className="tw:truncate">{label}</span>
        </Button>
        <Popover
          aria-label={t('label.ontology-plural')}
          className={isAiMode ? 'tw:w-80' : 'tw:w-72'}
          placement="bottom left">
          {renderPanel()}
        </Popover>
      </PopoverTrigger>
      {pendingDelete ? (
        <OntologyDeleteDialog
          ontology={pendingDelete}
          onClose={() => setPendingDelete(undefined)}
          onDeleted={(deleted) => {
            setPendingDelete(undefined);
            void queryClient.invalidateQueries({
              queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
            });
            showSuccessToast(
              t('message.ontology-deleted', { name: getEntityName(deleted) })
            );
            onOntologyDeleted?.(deleted);
          }}
        />
      ) : null}
    </>
  );
};

export default OntologyStudioScopeMenu;
