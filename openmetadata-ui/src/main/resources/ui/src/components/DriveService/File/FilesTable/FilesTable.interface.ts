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
import { PagingWithoutTotal } from 'Models';
import { Dispatch, SetStateAction } from 'react';
import { File } from '../../../../generated/entity/data/file';
import { UsePagingInterface } from '../../../../hooks/paging/usePaging';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';

export interface FilesTableProps {
  showDeleted: boolean;
  handleShowDeleted: (checked: boolean) => void;
  paging: UsePagingInterface;
  handlePageChange: (data: PagingHandlerParams) => void;
  files: File[];
  isLoading: boolean;
  fetchFiles: (paging?: PagingWithoutTotal) => void;
  setFiles: Dispatch<SetStateAction<File[]>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  serviceFqn: string;
}
