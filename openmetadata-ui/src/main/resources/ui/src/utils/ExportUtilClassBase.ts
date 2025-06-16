/*
 *  Copyright 2024 Collate.
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

import { ExportData } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../constants/Export.constants';
import { exportPNGImageFromElement } from './Export/ExportUtils';

class ExportUtilClassBase {
  public getExportTypeOptions(): {
    label: string;
    value: ExportTypes;
  }[] {
    return Object.values(ExportTypes).map((exportType) => ({
      label: exportType,
      value: exportType,
    }));
  }

  public exportMethodBasedOnType(data: {
    exportType: ExportTypes;
    exportData: ExportData;
  }) {
    const { exportType, exportData } = data;
    if (exportType === ExportTypes.PNG) {
      return exportPNGImageFromElement(exportData);
    }

    return null;
  }
}

const exportUtilClassBase = new ExportUtilClassBase();

export default exportUtilClassBase;

export { ExportUtilClassBase };
