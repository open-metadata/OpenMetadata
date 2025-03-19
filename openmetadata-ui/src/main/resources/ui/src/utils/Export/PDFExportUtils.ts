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
import jsPDF from 'jspdf';

const addHeaderInPdf = (pdf: jsPDF, headerData: { title: string }) => {
  pdf.saveGraphicsState();

  // Set header styles and add header content
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(headerData.title, 10, 10); // Left aligned
  pdf.restoreGraphicsState(); // Restore state
};

export const convertPngToPDFExport = (
  base64Image: string,
  fileName: string,
  headerData?: {
    title: string;
  }
) => {
  const pdf = new jsPDF();
  if (headerData) {
    addHeaderInPdf(pdf, headerData);
  }

  // PDF dimensions (A4 size)
  const pdfWidth = pdf.internal.pageSize.width;
  const pdfHeight = pdf.internal.pageSize.height;

  // Set indentation
  const indent = 10;
  const availableWidth = pdfWidth - 2 * indent; // Account for left and right indentation

  const img = new Image();
  img.src = base64Image;

  // Once the image has loaded, calculate dimensions and add it to the PDF
  img.onload = function () {
    const aspectRatio = img.width / img.height;

    // Calculate width and height to fit the PDF with indentation
    let imgWidth = availableWidth; // Use available width after indentation
    let imgHeight = imgWidth / aspectRatio;

    // If the image height exceeds the PDF page height, scale it down
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight;
      imgWidth = pdfHeight * aspectRatio;

      // Recalculate left indent to center if image is height-constrained
      const horizontalIndent = (pdfWidth - imgWidth) / 2;
      pdf.addImage(
        base64Image,
        'PNG',
        horizontalIndent,
        15,
        imgWidth,
        imgHeight
      );
    } else {
      // Use standard indentation if image is width-constrained
      pdf.addImage(base64Image, 'PNG', indent, 15, imgWidth, imgHeight);
    }
    pdf.save(`${fileName}.pdf`);
  };
};
