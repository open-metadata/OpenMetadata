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

// The tour's grants on its mock table. Kept apart from mockTourData.constants, which cannot be
// tree-shaken, so pages that only need the grants do not ship the whole mock dataset.
export const mockTablePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewDataProfile: true,
  EditAll: true,
};

// The Explore summary panel's grant on the tour's mock table: view only. No edit or test
// controls, since every edit would PATCH a table that does not exist, and the data quality
// tab would query it by FQN.
export const mockTourSummaryPanelPermission = {
  ViewBasic: true,
};
