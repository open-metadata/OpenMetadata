/*
 *  Copyright 2022 Collate.
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

export enum SIZE {
  X_SMALL = '40',
  SMALL = '60',
  MEDIUM = '86',
  LARGE = '126',
  X_LARGE = '166',
}

export enum ACTION_TYPE {
  UPDATE = 'update',
  REMOVE = 'remove',
}

export enum LOADING_STATE {
  INITIAL = 'initial',
  WAITING = 'waiting',
  SUCCESS = 'success',
}

export enum PROMISE_STATE {
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

export enum OPERATION {
  UPDATE = 'update',
  DELETE = 'delete',
  NO_OPERATION = 'no-operation',
}

export enum SORT_ORDER {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ERROR_PLACEHOLDER_TYPE {
  CREATE = 'CREATE',
  ASSIGN = 'ASSIGN',
  FILTER = 'FILTER',
  CUSTOM = 'CUSTOM',
  PERMISSION = 'PERMISSION',
  NO_DATA = 'NO_DATA',
}

export enum ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE {
  NO_DATA = 'NO_DATA',
  ERROR = 'ERROR',
}
