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
import { useTranslation } from 'react-i18next';
import SectionWithEdit from '../SectionWithEdit/SectionWithEdit';
import CommonEntitySummaryInfoV1 from './CommonEntitySummaryInfoV1';
import './OverviewSection.less';

export interface OverviewSectionProps {
  onEdit?: () => void;
  showEditButton?: boolean;
  entityInfoV1?: Array<{
    name: string;
    value?: any;
    url?: string;
    linkProps?: import('react-router-dom').To;
    isLink?: boolean;
    isExternal?: boolean;
    visible?: string[];
  }>;
  componentType?: string;
  isDomainVisible?: boolean;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  onEdit,
  showEditButton = false,
  entityInfoV1,
  componentType = '',
  isDomainVisible = false,
}) => {
  const { t } = useTranslation();

  // Compute visible rows when using entityInfoV1
  const visibleEntityInfo = entityInfoV1
    ? entityInfoV1.filter((info) => {
        const isDomain =
          isDomainVisible && info.name === t('label.domain-plural');

        return (info.visible || []).includes(componentType) || isDomain;
      })
    : [];

  // Hide the entire section (including title) when there's no content
  const hasContent = entityInfoV1 && visibleEntityInfo.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <SectionWithEdit
      showEditButton={showEditButton}
      title={t('label.overview')}
      onEdit={onEdit}>
      {entityInfoV1 && (
        <CommonEntitySummaryInfoV1
          componentType={componentType}
          entityInfo={entityInfoV1}
          isDomainVisible={isDomainVisible}
        />
      )}
    </SectionWithEdit>
  );
};

export default OverviewSection;
