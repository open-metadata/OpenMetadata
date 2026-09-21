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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { PreviewRendererProps } from './FilePreviewer.types';

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
