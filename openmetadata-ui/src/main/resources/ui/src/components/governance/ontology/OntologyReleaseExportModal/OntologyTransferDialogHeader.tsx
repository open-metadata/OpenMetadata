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
  Box,
  CloseButton,
  Dialog,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

interface OntologyTransferDialogHeaderProps {
  readonly icon: FC<{ className?: string }>;
  readonly isCloseDisabled?: boolean;
  readonly subtitle?: string;
  readonly title: string;
  readonly onClose: () => void;
}

/** The icon tile, title, ontology name and close button the import and export dialogs share. */
const OntologyTransferDialogHeader = ({
  icon,
  isCloseDisabled,
  subtitle,
  title,
  onClose,
}: OntologyTransferDialogHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Dialog.Header className="tw:flex tw:items-start tw:gap-4">
      <FeaturedIcon color="gray" icon={icon} size="lg" theme="modern" />
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Heading
          className="tw:m-0 tw:text-lg tw:font-semibold tw:text-primary"
          slot="title">
          {title}
        </Heading>
        {subtitle && (
          <Typography
            className="tw:break-words"
            color="secondary"
            data-testid="ontology-transfer-dialog-subtitle"
            size="text-sm">
            {subtitle}
          </Typography>
        )}
      </Box>
      <CloseButton
        className="tw:shrink-0"
        isDisabled={isCloseDisabled}
        label={t('label.close')}
        onPress={onClose}
      />
    </Dialog.Header>
  );
};

export default OntologyTransferDialogHeader;
