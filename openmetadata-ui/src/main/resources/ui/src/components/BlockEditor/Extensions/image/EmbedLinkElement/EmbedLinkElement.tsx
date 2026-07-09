/*
 *  Copyright 2025 Collate.
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
  Box,
  Button,
  FormField,
  HintText,
  HookForm,
  Input,
} from '@openmetadata/ui-core-components';
import { FC, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { UPLOADED_ASSETS_URL } from '../../../../../constants/BlockEditor.constants';
import { isValidUrl } from '../../../../../utils/SSOUtils';
import { ImagePopoverContentProps } from '../ImageComponent.interface';

interface EmbedLinkFormValues {
  Url: string;
}

const EmbedLinkElement: FC<ImagePopoverContentProps> = ({
  updateAttributes,
  onPopupVisibleChange,
  onUploadingChange,
  src,
  deleteNode,
  fileType,
}) => {
  const { t } = useTranslation();
  const form = useForm<EmbedLinkFormValues>({ defaultValues: { Url: src } });

  useEffect(() => {
    form.reset({ Url: src });
  }, [src]);

  const isAssetsUrl = useMemo(() => {
    return src?.includes(UPLOADED_ASSETS_URL);
  }, [src]);

  const handleEmbedImage = (values: EmbedLinkFormValues) => {
    onPopupVisibleChange(false);
    onUploadingChange(true);
    updateAttributes({ src: values.Url });
    onUploadingChange(false);
  };

  const handleDelete = () => {
    deleteNode();
  };

  return (
    <HookForm
      data-testid="embed-link-form"
      form={form}
      onSubmit={form.handleSubmit(handleEmbedImage)}>
      <FormField
        control={form.control}
        name="Url"
        rules={{
          required: t('label.field-required', {
            field: t('label.url-uppercase'),
          }),
          validate: (value: string) =>
            isValidUrl(value) || t('label.invalid-url'),
        }}>
        {({ field, fieldState }) => (
          <>
            <Input
              autoFocus
              inputDataTestId="embed-input"
              isInvalid={fieldState.invalid}
              placeholder={
                t('label.paste-the-file-type-link', {
                  fileType: t(`label.${fileType}`),
                }) + ' ...'
              }
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </>
        )}
      </FormField>
      <div className="tw:mt-3 tw:flex tw:items-center tw:justify-between tw:gap-2">
        <Button color="tertiary-destructive" size="xs" onPress={handleDelete}>
          {t('label.delete')}
        </Button>
        <Box align='center' gap={3}>
          <Button
            color="tertiary"
            size="xs"
            onPress={() => onPopupVisibleChange(false)}>
            {t('label.close')}
          </Button>
          {isAssetsUrl ? null : (
            <Button className='tw:capitalize' color="primary" size="xs" type="submit">
              {t('label.embed-file-type', { fileType })}
            </Button>
          )}
        </Box>
      </div>
    </HookForm>
  );
};

export default EmbedLinkElement;
