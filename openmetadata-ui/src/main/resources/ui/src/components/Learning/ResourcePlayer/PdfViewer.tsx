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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { LinkExternal01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { LearningResource } from '../../../rest/learningResourceAPI';
import { getSafeHttpUrl } from '../../../utils/StringUtils';

interface PdfViewerProps {
  resource: LearningResource;
}

export const PdfViewer = ({ resource }: PdfViewerProps) => {
  const { t } = useTranslation();
  const pdfUrl = getSafeHttpUrl(resource.source.url);

  if (!pdfUrl) {
    return (
      <Typography as="span" className="tw:p-4" size="text-sm">
        {t('label.invalid-url')}
      </Typography>
    );
  }

  return (
    <Box className="tw:w-full tw:p-4" direction="col">
      <Box className="tw:w-full" direction="col" gap={3}>
        <Box className="tw:justify-end">
          <Button
            color="link-color"
            href={pdfUrl}
            iconTrailing={LinkExternal01}
            rel="noopener noreferrer"
            size="sm"
            target="_blank">
            {t('label.open-in-new-tab')}
          </Button>
        </Box>
        {/* Not sandboxed: browsers disable their built-in PDF viewer inside sandboxed frames. */}
        <iframe
          className="tw:min-h-[60vh] tw:w-full tw:flex-1 tw:rounded-lg tw:border tw:border-secondary"
          src={pdfUrl}
          title={resource.displayName || resource.name}
        />
      </Box>
    </Box>
  );
};
