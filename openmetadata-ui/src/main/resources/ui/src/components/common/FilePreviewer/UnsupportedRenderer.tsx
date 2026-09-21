/*
 *  Copyright OpenMetadata Collective SPDX-License-Identifier: Apache-2.0
 */

import { useTranslation } from 'react-i18next';
import { Button, Typography } from '@openmetadata/ui-core-components';
import { PreviewRendererProps } from './FilePreviewer.interface';

const UnsupportedRenderer = ({ fileName, objectUrl }: PreviewRendererProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:p-8">
      <Typography className="tw:text-secondary">
        {t('message.preview-not-supported')}
      </Typography>
      <Button download={fileName} href={objectUrl} size="sm">
        {t('label.download')}
      </Button>
    </div>
  );
};

export default UnsupportedRenderer;
