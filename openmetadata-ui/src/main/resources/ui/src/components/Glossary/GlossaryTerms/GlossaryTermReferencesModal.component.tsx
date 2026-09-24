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
  ButtonUtility,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, PlusCircle } from '@openmetadata/ui-core-components/icons';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { TermReference } from '../../../generated/entity/data/glossaryTerm';
import { validateReferenceURL } from '../../../utils/GlossaryPureUtils';

interface GlossaryTermReferencesModalProps {
  references: TermReference[];
  isVisible: boolean;
  onClose: () => void;
  onSave: (values: TermReference[]) => Promise<void>;
}

interface ReferencesFormValues {
  references: TermReference[];
}

const EMPTY_REFERENCE: TermReference = { name: '', endpoint: '' };

const isParsableURL = (value: string) => {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
};

const GlossaryTermReferencesModal = ({
  references,
  isVisible,
  onClose,
  onSave,
}: GlossaryTermReferencesModalProps) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState<boolean>(false);
  const { control, handleSubmit, reset } = useForm<ReferencesFormValues>({
    defaultValues: { references: [EMPTY_REFERENCE] },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'references',
  });

  const validateEndpoint = (value?: string) => {
    const endpoint = value?.trim();

    if (!endpoint) {
      return t('label.field-required', { field: t('label.endpoint') });
    }
    if (!validateReferenceURL(endpoint)) {
      return t('message.url-must-start-with-http-or-https');
    }

    return isParsableURL(endpoint) || t('message.endpoint-should-be-valid');
  };

  const onSubmit = async (values: ReferencesFormValues) => {
    try {
      setSaving(true);
      await onSave(
        values.references.map(({ name, endpoint }) => ({
          name: name?.trim(),
          endpoint: endpoint?.trim(),
        }))
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      reset({
        references: references.length > 0 ? references : [EMPTY_REFERENCE],
      });
    }
  }, [isVisible]);

  return (
    <ModalOverlay
      isDismissable
      isOpen={isVisible}
      // The library overlay is `tw:z-50`, which loses to antd overlays
      // (z-index 1000) still present on the glossary term page.
      style={{ zIndex: 'var(--om-z-modal)' }}
      onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal>
        <Dialog
          aria-label={t('label.reference-plural')}
          data-testid="glossary-term-references-modal"
          width={640}>
          <Dialog.Header>
            <Typography
              as="h3"
              className="tw:text-primary"
              size="text-md"
              weight="semibold">
              {t('label.reference-plural')}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <form
              noValidate
              className="tw:flex tw:flex-col tw:gap-3"
              onSubmit={handleSubmit(onSubmit)}>
              {fields.map((field, index) => (
                <div className="tw:flex tw:items-start tw:gap-2" key={field.id}>
                  <Controller
                    control={control}
                    name={`references.${index}.name`}
                    render={({ field: nameField, fieldState }) => (
                      <Input
                        className="tw:flex-1"
                        hint={fieldState.error?.message}
                        id={`references_${index}_name`}
                        isInvalid={Boolean(fieldState.error)}
                        placeholder={t('label.name')}
                        value={nameField.value ?? ''}
                        onBlur={nameField.onBlur}
                        onChange={nameField.onChange}
                      />
                    )}
                    rules={{
                      validate: (value) =>
                        Boolean(value?.trim()) ||
                        t('label.field-required', { field: t('label.name') }),
                    }}
                  />
                  <Controller
                    control={control}
                    name={`references.${index}.endpoint`}
                    render={({ field: endpointField, fieldState }) => (
                      <Input
                        className="tw:flex-1"
                        hint={fieldState.error?.message}
                        id={`references_${index}_endpoint`}
                        isInvalid={Boolean(fieldState.error)}
                        placeholder={t('label.endpoint')}
                        value={endpointField.value ?? ''}
                        onBlur={endpointField.onBlur}
                        onChange={endpointField.onChange}
                      />
                    )}
                    rules={{ validate: validateEndpoint }}
                  />
                  <ButtonUtility
                    className="tw:mt-1"
                    color="tertiary"
                    data-testid="delete-ref-btn"
                    icon={Delete}
                    size="sm"
                    tooltip={t('label.delete')}
                    onClick={() => remove(index)}
                  />
                </div>
              ))}
              <Button
                className="tw:w-fit"
                color="link-color"
                data-testid="add-references-button"
                iconLeading={PlusCircle}
                size="sm"
                onClick={() => append(EMPTY_REFERENCE)}>
                {t('label.add')}
              </Button>
            </form>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="md" onClick={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-btn"
              isLoading={saving}
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

export default GlossaryTermReferencesModal;
