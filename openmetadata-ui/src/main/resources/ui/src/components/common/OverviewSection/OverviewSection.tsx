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
import { OverviewSectionProps } from './OverviewSection.interface';
import './OverviewSection.less';

const EXCLUDED_ITEMS = ['Owners', 'Tier'];

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
    return (
      <div className="overview-section">
        <span className="no-data-placeholder">
          {t('label.no-overview-available')}
        </span>
      </div>
    );
  }

  return (
    <SectionWithEdit
      showEditButton={showEditButton}
      title={t('label.overview')}
      onEdit={onEdit}>
      <CommonEntitySummaryInfoV1
        componentType={componentType}
        entityInfo={entityInfoV1}
        excludedItems={EXCLUDED_ITEMS}
        isDomainVisible={isDomainVisible}
      />
    </SectionWithEdit>
  );
};

export default OverviewSection;
