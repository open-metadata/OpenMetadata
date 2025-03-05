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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import i18n from '../i18next/LocalUtil';
import { showErrorToast } from '../ToastUtils';

export const exportAsPDF = async (elmId: string, fileName: string) => {
  try {
    const exportElement = document.getElementById(elmId);
    if (!exportElement) {
      return;
    }

    // Get the full height of the content
    const scrollHeight = exportElement.scrollHeight;
    const scrollWidth = exportElement.scrollWidth;

    // Set temporary styles to capture full content
    const originalStyle = exportElement.style.cssText;
    exportElement.style.height = `${scrollHeight}px`;
    exportElement.style.width = `${scrollWidth}px`;
    exportElement.style.position = 'absolute';
    exportElement.style.top = '0';
    exportElement.style.left = '0';

    const canvas = await html2canvas(exportElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      height: scrollHeight,
      width: scrollWidth,
      windowHeight: scrollHeight,
      windowWidth: scrollWidth,
    });

    // Restore original styles
    exportElement.style.cssText = originalStyle;

    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    // If content is longer than A4, add multiple pages
    let heightLeft = imgHeight;
    let position = 0;
    const pageHeight = 295; // A4 height in mm

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    showErrorToast(error as AxiosError, i18n.t('message.error-generating-pdf'));
  }
};
