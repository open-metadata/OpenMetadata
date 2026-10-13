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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/add-placeholder.svg';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import PermissionErrorPlaceholder from './PermissionErrorPlaceholder';
import { CreatePlaceholderProps } from './placeholder.interface';

const CreateErrorPlaceHolder = ({
  size,
  className,
  permission,
  onClick,
  heading,
  doc,
  buttonId,
  placeholderText,
  permissionValue,
}: CreatePlaceholderProps) => {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();

  if (!permission) {
    return (
      <PermissionErrorPlaceholder
        className={className}
        permissionValue={permissionValue}
        size={size}
      />
    );
  }

  return (
    <Box
      align="center"
      className={classNames(
        className,
        'h-full border-default border-radius-sm tw:bg-surface w-full'
      )}
      data-testid={`create-error-placeholder-${heading}`}
      justify="center">
      <Box align="center" className="tw:w-full tw:gap-2.5" direction="col">
        <AddPlaceHolderIcon
          data-testid="no-data-image"
          height={size}
          width={size}
        />
        <div className="text-center text-sm font-normal">
          <Typography as="p" className="tw:mb-3.5!">
            {placeholderText ??
              t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
                entity: heading,
              })}
          </Typography>
          {!placeholderText && (
            <Typography as="p" className="tw:mb-3.5!">
              <Transi18next
                i18nKey="message.refer-to-our-doc"
                renderElement={
                  <a
                    aria-label={t('label.documentation')}
                    href={doc}
                    rel="noreferrer"
                    style={{ color: theme.primaryColor }}
                    target="_blank"
                  />
                }
                values={{
                  doc: t('label.doc-plural-lowercase'),
                }}
              />
            </Typography>
          )}

          {onClick && (
            <Button
              color="secondary-brand"
              data-testid={buttonId ?? 'add-placeholder-button'}
              iconLeading={Plus}
              size="sm"
              onPress={onClick}>
              {t('label.add')}
            </Button>
          )}
        </div>
      </Box>
    </Box>
  );
};

export default CreateErrorPlaceHolder;
