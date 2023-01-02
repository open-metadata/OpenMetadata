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

export enum ADMIN_ONLY_ACCESSIBLE_SECTION {
  TEAM = 'team',
  SERVICE = 'service',
}

export enum SIZE {
  SMALL = '60',
  MEDIUM = '80',
  LARGE = '100',
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
