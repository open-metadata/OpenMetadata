/*
 *  Copyright 2023 Collate.
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
  Dialog,
  InputBase,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import { TextField as AriaTextField } from 'react-aria-components';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { getSanitizeContent } from '../../../utils/sanitize.utils';
import {
  EntityName,
  EntityNameModalProps,
  EntityNameValidationRule,
} from './EntityNameModal.interface';

const buildValidate =
  (rules: EntityNameValidationRule[] = []) =>
  (value: string | undefined): string | true => {
    const v = value ?? '';
    for (const rule of rules) {
      // Skip length/pattern checks for empty non-required values,
      // mirroring antd async-validator behavior.
      if (v.length === 0 && !rule.required) {
        continue;
      }
      if (rule.min !== undefined && v.length < rule.min) {
        return rule.message ?? '';
      }
      if (rule.max !== undefined && v.length > rule.max) {
        return rule.message ?? '';
      }
      if (rule.pattern && !rule.pattern.test(v)) {
        return rule.message ?? '';
      }
    }

    return true;
  };

interface SanitizedFieldProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  isDisabled?: boolean;
  isInvalid?: boolean;
  placeholder?: string;
}

/**
 * Wraps InputBase in an AriaTextField to get proper onChange(string) handling.
 * The id prop flows through AriaTextField → InputContext → AriaInput → <input id={id}>.
 * The AriaTextField wrapper div does NOT receive the id (deleted from DOMProps).
 */
const SanitizedField = ({
  id,
  value,
  onChange,
  isDisabled,
  isInvalid,
  placeholder,
}: SanitizedFieldProps) => (
  <AriaTextField
    id={id}
    isDisabled={isDisabled}
    isInvalid={isInvalid}
    value={value}
    onChange={(val) => onChange(getSanitizeContent(val))}>
    <InputBase
      inputDataTestId={id}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      placeholder={placeholder}
    />
  </AriaTextField>
);

const EntityNameModal = <T extends EntityName>({
  visible,
  entity,
  onCancel,
  onSave,
  title,
  // re-name will update actual name of the entity, it will impact across application
  // By default its disabled, send allowRename true to get the functionality
  allowRename = false,
  nameValidationRules = [],
  additionalFields,
  displayNameValidationRules = [],
}: EntityNameModalProps<T>) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, reset } = useForm<EntityName>({
    mode: 'onChange',
    defaultValues: {
      name: entity.name,
      displayName: entity.displayName ?? '',
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        name: entity.name,
        displayName: entity.displayName ?? '',
      });
    }
    // Depend on primitive values, not the entity object reference —
    // inline objects (e.g. ManageButton's entity={{ name, displayName }})
    // are recreated every render, which would wipe in-progress edits.
  }, [visible, entity.name, entity.displayName, reset]);

  const onSubmit = async (data: EntityName) => {
    setIsLoading(true);
    await onSave(data as T);
    setIsLoading(false);
  };

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog width={520}>
          <Dialog.Header>
            <Typography
              as="h3"
              className="tw:text-md tw:font-semibold tw:text-primary"
              data-testid="header">
              {title}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <form
              className="tw:flex tw:flex-col tw:gap-4"
              onSubmit={handleSubmit(onSubmit)}>
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <label
                  className="tw:text-sm tw:font-medium tw:text-secondary"
                  htmlFor="name">
                  {t('label.name')}
                </label>
                <Controller
                  control={control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <>
                      <SanitizedField
                        id="name"
                        isDisabled={!allowRename}
                        isInvalid={!!fieldState.error}
                        placeholder={t('label.enter-entity-name', {
                          entity: t('label.glossary'),
                        })}
                        value={field.value}
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <span
                          className="tw:text-sm tw:text-error-primary"
                          id="name_help">
                          {fieldState.error.message}
                        </span>
                      )}
                    </>
                  )}
                  rules={{
                    required: `${t('label.field-required', {
                      field: t('label.name'),
                    })}`,
                    pattern: {
                      value: ENTITY_NAME_REGEX,
                      message: t('message.entity-name-validation'),
                    },
                    validate: buildValidate(nameValidationRules),
                  }}
                />
              </div>

              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <label
                  className="tw:text-sm tw:font-medium tw:text-secondary"
                  htmlFor="displayName">
                  {t('label.display-name')}
                </label>
                <Controller
                  control={control}
                  name="displayName"
                  render={({ field, fieldState }) => (
                    <>
                      <SanitizedField
                        id="displayName"
                        isInvalid={!!fieldState.error}
                        placeholder={t('message.enter-display-name')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <span className="tw:text-sm tw:text-error-primary">
                          {fieldState.error.message}
                        </span>
                      )}
                    </>
                  )}
                  rules={{
                    validate: buildValidate(displayNameValidationRules),
                  }}
                />
              </div>

              {additionalFields}
            </form>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="md" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-button"
              isLoading={isLoading}
              size="md"
              onClick={handleSubmit(onSubmit)}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default EntityNameModal;
