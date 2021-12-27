/*
 *  Copyright 2021 Collate
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

import { Topic } from '../../generated/entity/data/topic';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import { VersionData } from '../../pages/EntityVersionPage/EntityVersionPage.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface TopicVersionProp {
  version: string;
  currentVersionData: VersionData;
  isVersionLoading: boolean;
  owner: Topic['owner'];
  tier: TagLabel;
  slashedTopicName: TitleBreadcrumbProps['titleLinks'];
  topicFQN: string;
  versionList: EntityHistory;
  backHandler: () => void;
  versionHandler: (v: string) => void;
}
