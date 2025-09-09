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
import './OverviewSection.less';

interface OverviewItem {
  label: string;
  value: string | number;
}

interface OverviewSectionProps {
  items: OverviewItem[];
  onEdit?: () => void;
  showEditButton?: boolean;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  items,
  onEdit,
  showEditButton = false,
}) => {
  const { t } = useTranslation();

  return (
    <SectionWithEdit
      showEditButton={showEditButton}
      title={t('label.overview')}
      onEdit={onEdit}>
      <div className="overview-items">
        {items.map((item, index) => (
          <div className="overview-item" key={index}>
            <span className="overview-label">{item.label}</span>
            <span className="overview-value">{item.value}</span>
          </div>
        ))}
      </div>
    </SectionWithEdit>
  );
};

export default OverviewSection;
