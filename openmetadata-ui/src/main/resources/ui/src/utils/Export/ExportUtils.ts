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
import { AxiosError } from 'axios';
import { toPng } from 'html-to-image';
import { isUndefined, lowerCase } from 'lodash';
import { ExportData } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../../constants/Export.constants';
import i18n from '../i18next/LocalUtil';
import { showErrorToast } from '../ToastUtils';

export const downloadImageFromBase64 = (
  dataUrl: string,
  fileName: string,
  exportType: ExportTypes
) => {
  const a = document.createElement('a');
  a.setAttribute('download', `${fileName}.${lowerCase(exportType)}`);
  a.setAttribute('href', dataUrl);
  a.click();
};

export const exportPNGImageFromElement = async (exportData: ExportData) => {
  const { name, documentSelector = '', viewport } = exportData;

  const exportElement = document.querySelector(documentSelector);

  if (!exportElement) {
    throw new Error(
      i18n.t('message.error-generating-export-type', {
        exportType: ExportTypes.PNG,
      })
    );
  }

  // Minimum width and height for the image
  const minWidth = 1000;
  const minHeight = 800;
  const padding = 20;

  const imageWidth = Math.max(minWidth, exportElement.scrollWidth);
  const imageHeight = Math.max(minHeight, exportElement.scrollHeight);

  await toPng(exportElement as HTMLElement, {
    backgroundColor: '#ffffff',
    width: imageWidth + padding * 2,
    height: imageHeight + padding * 2,
    pixelRatio: 3,
    quality: 1.0,
    style: {
      width: imageWidth.toString(),
      height: imageHeight.toString(),
      margin: `${padding}px`,
      minWidth: `${minWidth}px`,
      minHeight: `${minHeight}px`,
      ...(!isUndefined(viewport)
        ? {
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }
        : {}),
    },
  })
    .then((base64Image: string) => {
      downloadImageFromBase64(base64Image, name, ExportTypes.PNG);
    })
    .catch((error) => {
      const errorMessage = (error as Error).message ?? '';
      const isInvalidStringLength = errorMessage.includes(
        'Invalid string length'
      );

      if (isInvalidStringLength) {
        showErrorToast(
          error as AxiosError,
          i18n.t('message.invalid-string-length-error', {
            exportType: ExportTypes.PNG,
            entity: exportData.title,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          i18n.t('message.error-generating-export-type', {
            exportType: ExportTypes.PNG,
          })
        );
      }
    });
};
