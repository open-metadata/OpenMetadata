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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/ic-no-records.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getEntityChildDetailsV1 } from '../../../utils/EntitySummaryPanelUtilsV1';
import ErrorPlaceHolderNew from '../ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../Loader/Loader';
import { EntityDetailsSectionProps } from './EntityDetailsSection.interface';
import './EntityDetailsSection.less';
const EntityDetailsSection: React.FC<EntityDetailsSectionProps> = ({
  entityType,
  dataAsset,
  highlights,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const entityDetails = useMemo(() => {
    return getEntityChildDetailsV1(
      entityType,
      dataAsset,
      highlights,
      isLoading
    );
  }, [dataAsset, entityType, highlights, isLoading]);

  if (isLoading) {
    return <Loader size="small" />;
  }

  if (isEmpty(dataAsset)) {
    return null;
  }

  return dataAsset && !isEmpty(entityDetails) ? (
    <div
      className="entity-details-section"
      data-testid="entity-details-section">
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
