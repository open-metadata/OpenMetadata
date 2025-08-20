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
import { FileType } from '../generated/entity/data/file';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';

export interface GetFilesParams {
  fields?: string;
  directory?: string;
  fileType?: FileType;
  include?: Include;
  paging?: Omit<Paging, 'total'>;
}

export interface GetDirectoriesParams {
  fields?: string;
  service?: string;
  parent?: string;
  root?: string;
  include?: Include;
  paging?: Omit<Paging, 'total'>;
}

export interface GetSpreadsheetParams {
  fields?: string;
  service?: string;
  directory?: string;
  include?: Include;
  paging?: Omit<Paging, 'total'>;
}

export interface GetWorksheetsParams {
  fields?: string;
  service?: string;
  spreadsheet?: string;
  include?: Include;
  paging?: Omit<Paging, 'total'>;
}
