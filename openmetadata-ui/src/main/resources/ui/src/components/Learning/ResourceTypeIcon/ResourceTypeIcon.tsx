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

import {
  IconProps,
  LearningLink,
  LearningPdf,
  LearningStorylane,
  LearningVideo,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResourceType,
  RESOURCE_TYPE_LABEL_KEYS,
} from '../../../constants/Learning.constants';
import { LearningResourceType } from '../../../rest/learningResourceAPI';

const RESOURCE_TYPE_ICONS: Partial<
  Record<LearningResourceType, FC<IconProps>>
> = {
  Link: LearningLink,
  PDF: LearningPdf,
  Storylane: LearningStorylane,
  Video: LearningVideo,
};

interface ResourceTypeIconProps extends IconProps {
  resourceType: LearningResourceType;
}

export const ResourceTypeIcon = ({
  resourceType,
  ...iconProps
}: ResourceTypeIconProps) => {
  const { t } = useTranslation();
  const iconType: LearningResourceType = RESOURCE_TYPE_ICONS[resourceType]
    ? resourceType
    : ResourceType.Video;
  const Icon = RESOURCE_TYPE_ICONS[iconType] ?? LearningVideo;

  // Generated icons default to aria-hidden; the type icon is the only type cue on cards and rows.
  return (
    <Icon
      aria-hidden={false}
      aria-label={t(RESOURCE_TYPE_LABEL_KEYS[resourceType])}
      data-testid={`resource-type-icon-${iconType}`}
      role="img"
      {...iconProps}
    />
  );
};
