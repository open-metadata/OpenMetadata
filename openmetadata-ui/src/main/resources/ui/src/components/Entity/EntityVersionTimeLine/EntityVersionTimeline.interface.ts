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
import { ChangeDescription } from '../../../generated/entity/type';
import { EntityHistory } from '../../../generated/type/entityHistory';

export type EntityVersionTimelineProps = {
  versionList: EntityHistory;
  currentVersion: string;
  versionHandler: (v: string) => void;
  onBack: () => void;
};

export type EntityVersionButtonProps = {
  version: {
    updatedBy: string;
    version: string;
    changeDescription: ChangeDescription;
    updatedAt: number;
    glossary: string;
  };
  onVersionSelect: (v: string) => void;
  selected: boolean;
  isMajorVersion: boolean;
};
