/*
 *  Copyright 2022 Collate.
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
  Autocomplete,
  BadgeWithButton,
  Box,
  Button,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { MAX_VISIBLE_SYNONYMS } from '../../../../constants/Glossary.contant';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../../generated/entity/type';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../../utils/EntityDiffPureUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { SynonymBadge } from '../../GlossaryTermBadges/GlossaryTermBadges';

// Narrower than SynonymBadge's default so two long synonyms fit per row.
const SYNONYM_BADGE_CLASS = 'tw:max-w-24';

// Synonyms are free text: there is nothing to suggest, only typed values.
const NO_SUGGESTIONS: SelectItemType[] = [];

interface DuplicateSynonym {
  typed: string;
  existing: string;
}

const GlossaryTermSynonyms = () => {
  const [isViewMode, setIsViewMode] = useState<boolean>(true);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateSynonym>();
  const editorRef = useRef<HTMLDivElement>(null);
  const {
    data: glossaryTerm,
    onUpdate: onGlossaryTermUpdate,
    isVersionView,
    permissions,
  } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();

  // Consumer via useGenericContext(). No `deleted` argument: the old expressions here
  // never gated on glossaryTerm.deleted, only on a bare EditAll read, so
  // getDerivedPermissionFlags defaults to its `deleted = false` — nothing to gate.
  const { canEditAll } = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );

  const savedSynonyms = useMemo(
    () => (glossaryTerm.synonyms ?? []).filter((synonym) => !isEmpty(synonym)),
    [glossaryTerm.synonyms]
  );
  const selectedSynonyms = useMemo<SelectItemType[]>(
    () => synonyms.map((synonym) => ({ id: synonym, label: synonym })),
    [synonyms]
  );
  const hiddenSynonymCount = synonyms.length - MAX_VISIBLE_SYNONYMS;

  // Case-insensitive, so "Test" is rejected when "test" already exists.
  const findDuplicate = (value: string) => {
    const normalized = value.trim().toLowerCase();

    return normalized
      ? synonyms.find((synonym) => synonym.toLowerCase() === normalized)
      : undefined;
  };

  const handleSearchChange = (value: string) => {
    const existing = findDuplicate(value);
    setDuplicate(existing ? { typed: value.trim(), existing } : undefined);
  };

  const handleSynonymInserted = (key: string | number) => {
    const value = String(key);
    const existing = findDuplicate(value);
    if (existing) {
      setDuplicate({ typed: value, existing });
      // Autocomplete has already shown the chip; a fresh array re-syncs it
      // from selectedItems so the rejected value disappears again.
      setSynonyms((prev) => [...prev]);

      return;
    }
    setDuplicate(undefined);
    setSynonyms((prev) => [...prev, value]);
  };

  const handleSynonymCleared = (key: string | number) => {
    setDuplicate(undefined);
    setSynonyms((prev) => prev.filter((synonym) => synonym !== key));
  };

  // Enter also confirms an IME (ja/zh/ko) candidate; stop it before
  // Autocomplete's own Enter handler turns the half-composed text into a chip.
  const handleEditorKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && event.nativeEvent.isComposing) {
      event.stopPropagation();
    }
  };

  const renderSynonymTag = (item: SelectItemType, onRemove: () => void) => (
    <BadgeWithButton
      buttonLabel={t('label.remove-entity', { entity: item.label })}
      buttonTestId={`remove-synonym-${item.id}`}
      color={item.id === duplicate?.existing ? 'error' : 'gray'}
      key={item.id}
      size="sm"
      tooltip={item.label}
      type="color"
      onButtonClick={onRemove}
      // A custom tag drops Autocomplete's own chip keyboard handling, so
      // Backspace/Delete on the focused remove button is wired here.
      onButtonKeyDown={(event) => {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          onRemove();
          editorRef.current
            ?.querySelector<HTMLInputElement>('[role="combobox"]')
            ?.focus();
        }
      }}>
      <span className={`tw:block tw:truncate ${SYNONYM_BADGE_CLASS}`}>
        {item.label}
      </span>
    </BadgeWithButton>
  );

  const getSynonyms = () =>
    !canEditAll || !isEmpty(synonyms) ? (
      <Box align="center" gap={1} wrap="wrap">
        {(isListExpanded
          ? synonyms
          : synonyms.slice(0, MAX_VISIBLE_SYNONYMS)
        ).map((synonym) => (
          <SynonymBadge
            className={SYNONYM_BADGE_CLASS}
            key={synonym}
            synonym={synonym}
          />
        ))}

        {hiddenSynonymCount > 0 && (
          <Button
            color="link-color"
            data-testid="synonyms-show-more-btn"
            size="xs"
            onClick={() => setIsListExpanded((expanded) => !expanded)}>
            {isListExpanded
              ? t('label.show-less')
              : t('label.plus-count-more', {
                  count: hiddenSynonymCount,
                })}
          </Button>
        )}

        {!canEditAll && synonyms.length === 0 && (
          <Box>{NO_DATA_PLACEHOLDER}</Box>
        )}
      </Box>
    ) : null;

  const getSynonymsContainer = useCallback(() => {
    if (!isVersionView) {
      return getSynonyms();
    }
    const changeDescription = glossaryTerm.changeDescription;
    const synonymsDiff = getDiffByFieldName(
      EntityField.SYNONYMS,
      changeDescription as ChangeDescription
    );

    const addedSynonyms: string[] = JSON.parse(
      getChangedEntityNewValue(synonymsDiff) ?? '[]'
    );
    const deletedSynonyms: string[] = JSON.parse(
      getChangedEntityOldValue(synonymsDiff) ?? '[]'
    );

    const unchangedSynonyms = glossaryTerm.synonyms
      ? glossaryTerm.synonyms.filter(
          (synonym) =>
            !isEmpty(synonym) &&
            !addedSynonyms.find(
              (addedSynonym: string) => addedSynonym === synonym
            )
        )
      : [];

    const noSynonyms =
      isEmpty(unchangedSynonyms) &&
      isEmpty(addedSynonyms) &&
      isEmpty(deletedSynonyms);

    if (noSynonyms) {
      return <Box>{NO_DATA_PLACEHOLDER}</Box>;
    }

    return (
      <Box gap={1} wrap="wrap">
        {unchangedSynonyms
          .filter((synonym) => !isEmpty(synonym))
          .map((synonym) => (
            <SynonymBadge
              className={SYNONYM_BADGE_CLASS}
              key={synonym}
              synonym={synonym}
            />
          ))}
        {addedSynonyms
          .filter((synonym) => !isEmpty(synonym))
          .map((synonym) => (
            <SynonymBadge
              className={SYNONYM_BADGE_CLASS}
              key={synonym}
              synonym={synonym}
              versionStatus={{ added: true }}
            />
          ))}
        {deletedSynonyms
          .filter((synonym) => !isEmpty(synonym))
          .map((synonym) => (
            <SynonymBadge
              className={SYNONYM_BADGE_CLASS}
              key={synonym}
              synonym={synonym}
              versionStatus={{ removed: true }}
            />
          ))}
      </Box>
    );
  }, [glossaryTerm, isVersionView, getSynonyms]);

  const closeEditor = () => {
    setDuplicate(undefined);
    setIsListExpanded(false);
    setIsViewMode(true);
  };

  const handleCancel = () => {
    setSynonyms(savedSynonyms);
    closeEditor();
  };

  const handleSynonymsSave = async () => {
    if (!isEqual(synonyms, glossaryTerm.synonyms)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        synonyms,
      };
      setSaving(true);
      await onGlossaryTermUpdate(updatedGlossaryTerm);
      setSaving(false);
    }
    closeEditor();
  };

  useEffect(() => {
    if (glossaryTerm.synonyms?.length) {
      // removing empty string
      setSynonyms(glossaryTerm.synonyms.filter((synonym) => !isEmpty(synonym)));
    }
  }, [glossaryTerm]);

  const getSynonymsEditor = () => (
    <Box
      direction="col"
      ref={editorRef}
      onKeyDownCapture={handleEditorKeyDownCapture}>
      <Autocomplete
        allowsCreation
        hideDropdown
        multiple
        aria-label={t('label.synonym-plural')}
        data-testid="synonyms-select"
        hint={
          duplicate
            ? t('message.entity-already-exists', { entity: duplicate.typed })
            : t('message.synonym-input-hint')
        }
        icon={null}
        isInvalid={Boolean(duplicate)}
        items={NO_SUGGESTIONS}
        placeholder={
          isEmpty(synonyms)
            ? t('message.synonym-placeholder')
            : t('label.add-another')
        }
        renderTag={renderSynonymTag}
        selectedItems={selectedSynonyms}
        onItemCleared={handleSynonymCleared}
        onItemInserted={handleSynonymInserted}
        onSearchChange={handleSearchChange}>
        {null}
      </Autocomplete>
    </Box>
  );

  const getEditorFooter = () => (
    <Box align="center" gap={2}>
      {!isEqual(synonyms, savedSynonyms) && (
        <Typography as="span" className="tw:text-tertiary" size="text-xs">
          {t('message.unsaved-changes')}
        </Typography>
      )}
      <Box className="tw:ml-auto" gap={2}>
        <Button
          color="secondary"
          data-testid="cancel-synonym-btn"
          size="sm"
          onClick={handleCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-synonym-btn"
          isLoading={saving}
          size="sm"
          onClick={handleSynonymsSave}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );

  const headerExtra =
    canEditAll &&
    isViewMode &&
    (isEmpty(synonyms) ? (
      <WidgetPlusButton
        data-testid="synonym-add-button"
        title={t('label.add-entity', {
          entity: t('label.synonym-plural'),
        })}
        onClick={() => setIsViewMode(false)}
      />
    ) : (
      <WidgetEditButton
        data-testid="edit-button"
        title={t('label.edit-entity', {
          entity: t('label.synonym-plural'),
        })}
        onClick={() => setIsViewMode(false)}
      />
    ));

  // WidgetCard hides the body of a disabled card, so only disable it when the
  // body is empty anyway; read-only users still see the no-data placeholder.
  const isExpandDisabled =
    !isVersionView && isViewMode && canEditAll && isEmpty(synonyms);

  return (
    <WidgetCard
      dataTestId="synonyms-container"
      footer={isViewMode ? undefined : getEditorFooter()}
      headerExtra={headerExtra}
      isExpandDisabled={isExpandDisabled}
      title={t('label.synonym-plural')}>
      {isViewMode ? getSynonymsContainer() : getSynonymsEditor()}
    </WidgetCard>
  );
};

export default GlossaryTermSynonyms;
