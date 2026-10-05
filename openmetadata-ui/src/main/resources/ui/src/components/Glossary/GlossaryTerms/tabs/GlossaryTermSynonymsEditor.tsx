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
  BadgeWithButton,
  Box,
  Button,
  Card,
  HintText,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { findDuplicateSynonym } from './GlossaryTermSynonyms.utils';

interface GlossaryTermSynonymsEditorProps {
  synonyms: string[];
  savedSynonyms: string[];
  isSaving: boolean;
  onChange: (synonyms: string[]) => void;
  onCancel: () => void;
  onSave: () => void;
}

const GlossaryTermSynonymsEditor = ({
  synonyms,
  savedSynonyms,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: GlossaryTermSynonymsEditorProps) => {
  const { t } = useTranslation();
  const hintId = useId();
  const [inputValue, setInputValue] = useState('');
  const duplicateSynonym = findDuplicateSynonym(synonyms, inputValue);
  const isInvalid = Boolean(duplicateSynonym);

  const commitInput = () => {
    const synonym = inputValue.trim();
    if (synonym && !duplicateSynonym) {
      onChange([...synonyms, synonym]);
      setInputValue('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter also confirms an IME (ja/zh/ko) candidate; Safari reports that keydown as keyCode 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitInput();
    } else if (event.key === 'Backspace' && inputValue === '') {
      onChange(synonyms.slice(0, -1));
    }
  };

  return (
    <>
      <div className="tw:flex tw:flex-col tw:gap-1.5 tw:px-4 tw:pb-4">
        <div
          className={classNames(
            'tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2',
            'tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:focus-within:outline-2 tw:focus-within:-outline-offset-2',
            isInvalid
              ? 'tw:outline-error tw:focus-within:outline-error'
              : 'tw:outline-primary tw:focus-within:outline-brand'
          )}
          data-testid="synonyms-select">
          {synonyms.map((synonym) => (
            <BadgeWithButton
              buttonLabel={t('label.remove-entity', { entity: synonym })}
              buttonTestId={`remove-synonym-${synonym}`}
              color={synonym === duplicateSynonym ? 'error' : 'gray'}
              key={synonym}
              size="sm"
              tooltip={synonym}
              type="color"
              onButtonClick={() =>
                onChange(synonyms.filter((item) => item !== synonym))
              }>
              {/* Narrow enough that two long synonyms fit per row. */}
              <span className="tw:block tw:max-w-24 tw:truncate">
                {synonym}
              </span>
            </BadgeWithButton>
          ))}
          <input
            aria-describedby={hintId}
            aria-invalid={isInvalid}
            aria-label={t('label.synonym-plural')}
            className="tw:min-w-[30%] tw:flex-1 tw:bg-transparent tw:text-sm tw:text-primary tw:outline-hidden tw:placeholder:text-placeholder"
            data-testid="synonyms-input"
            placeholder={
              synonyms.length > 0
                ? t('label.add-another')
                : t('label.add-entity', { entity: t('label.synonym-plural') })
            }
            value={inputValue}
            // Blur commits typed text, so Save (which blurs first) keeps it.
            onBlur={commitInput}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <HintText className="tw:text-xs" id={hintId} isInvalid={isInvalid}>
          {isInvalid ? (
            t('message.entity-is-already-a-synonym', {
              entity: inputValue.trim(),
            })
          ) : (
            <Transi18next
              i18nKey="message.synonym-input-hint"
              renderElement={
                <kbd className="tw:rounded tw:border tw:border-secondary tw:bg-secondary tw:px-1 tw:font-sans tw:text-xs tw:text-tertiary" />
              }
            />
          )}
        </HintText>
      </div>

      <Card.Footer>
        <Box align="center" gap={2} justify="between">
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            {isEqual(synonyms, savedSynonyms)
              ? null
              : t('message.unsaved-changes')}
          </Typography>
          <Box gap={2}>
            <Button
              color="secondary"
              data-testid="cancel-synonym-btn"
              size="sm"
              onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-synonym-btn"
              isLoading={isSaving}
              size="sm"
              onClick={onSave}>
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      </Card.Footer>
    </>
  );
};

export default GlossaryTermSynonymsEditor;
