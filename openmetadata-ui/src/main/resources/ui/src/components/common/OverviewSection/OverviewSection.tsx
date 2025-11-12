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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SectionWithEdit from '../SectionWithEdit/SectionWithEdit';
import CommonEntitySummaryInfoV1 from './CommonEntitySummaryInfoV1';
import { OverviewSectionProps } from './OverviewSection.interface';
import './OverviewSection.less';

const OverviewSection: React.FC<OverviewSectionProps> = ({
  onEdit,
  showEditButton = false,
  entityInfoV1,
  componentType = '',
  isDomainVisible = false,
}) => {
  const { t } = useTranslation();

  const visibleEntityInfo = useMemo(() => {
    if (!entityInfoV1) {
      return [];
    }

    return entityInfoV1.filter((info) => {
      const isDomain =
        isDomainVisible && info.name === t('label.domain-plural');
      const isOwners = info.name === 'Owners';

      return (
        ((info.visible || []).includes(componentType) || isDomain) && !isOwners
      );
    });
  }, [entityInfoV1, componentType, isDomainVisible, t]);

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
      <CommonEntitySummaryInfoV1
        componentType={componentType}
        entityInfo={visibleEntityInfo}
        isDomainVisible={isDomainVisible}
      />
    </SectionWithEdit>
  );
};

export default OverviewSection;
