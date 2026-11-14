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
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportOntologyRelease } from '../../../rest/ontologyAPI';
import {
  NATIVE_EXPORT_EXTENSIONS,
  NATIVE_EXPORT_MEDIA_TYPES,
  OntologyReleaseExportFormat,
} from '../../../rest/ontologyExport.constants';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

/** Downloads one captured release in a chosen format. */
export const useOntologyReleaseDownload = (releaseId: string) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const exportRelease = async (format: OntologyReleaseExportFormat) => {
    setIsExporting(true);
    try {
      const content = await exportOntologyRelease(releaseId, format);
      downloadFile(
        content,
        `ontology-release-${releaseId}.${NATIVE_EXPORT_EXTENSIONS[format]}`,
        NATIVE_EXPORT_MEDIA_TYPES[format]
      );
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, exportRelease };
};
