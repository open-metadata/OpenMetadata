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
import { Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/ic-no-records.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getEntityChildDetailsV1 } from '../../../utils/EntitySummaryPanelUtilsV1';
import ErrorPlaceHolderNew from '../ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../Loader/Loader';
import SearchBarComponent from '../SearchBarComponent/SearchBar.component';
import { SEARCH_PLACEHOLDER_MAP } from './EntityDetailsSection.constants';
import { EntityDetailsSectionProps } from './EntityDetailsSection.interface';
import './EntityDetailsSection.less';

const EntityDetailsSection: React.FC<EntityDetailsSectionProps> = ({
  entityType,
  dataAsset,
  highlights,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState<string>('');

  const entityDetails = useMemo(() => {
    return getEntityChildDetailsV1(
      entityType,
      dataAsset,
      highlights,
      isLoading,
      searchText
    );
  }, [dataAsset, entityType, highlights, isLoading, searchText]);

  if (isLoading) {
    return <Loader size="small" />;
  }

  if (isEmpty(dataAsset)) {
    return null;
  }

  const searchLabel =
    SEARCH_PLACEHOLDER_MAP[entityType] || 'label.column-plural';

  return dataAsset && !isEmpty(entityDetails) ? (
    <div
      className="entity-details-section"
      data-testid="entity-details-section">
      <div className="p-x-md">
        <SearchBarComponent
          containerClassName="searchbar-container"
          placeholder={t('label.search-for-type', {
            type: t(searchLabel),
          })}
          searchValue={searchText}
          typingInterval={350}
          onSearch={setSearchText}
        />
      </div>
      {entityDetails}
    </div>
  ) : (
    <div className="lineage-items-list empty-state">
      <ErrorPlaceHolderNew
        className="text-grey-14"
        icon={<AddPlaceHolderIcon height={100} width={100} />}
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph className="text-center p-x-md m-t-sm no-data-placeholder">
          {t('message.no-schema-message')}
        </Typography.Paragraph>
      </ErrorPlaceHolderNew>
    </div>
  );
};

export default EntityDetailsSection;
