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
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from '../../../constants/Tag.constants';
import { Metric } from '../../../generated/entity/data/metric';
import { EntityReference } from '../../../generated/type/entityReference';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import './related-metrics.less';
import { RelatedMetricsForm } from './RelatedMetricsForm';

interface RelatedMetricsProps {
  isInSummaryPanel?: boolean;
  newLook?: boolean;
}

const RelatedMetrics: FC<RelatedMetricsProps> = ({
  isInSummaryPanel = false,
  newLook = false,
}) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [isShowMore, setIsShowMore] = useState(false);
  const {
    data: metricDetails,
    onUpdate: onMetricUpdate,
    permissions,
  } = useGenericContext<Metric>();

  const {
    defaultValue,
    initialOptions,
    visibleRelatedMetrics,
    hiddenRelatedMetrics,
    relatedMetrics,
  } = useMemo(() => {
    const relatedMetrics = metricDetails['relatedMetrics'] ?? [];

    const initialOptions: DataAssetOption[] = relatedMetrics.map((item) => {
      return {
        displayName: getEntityName(item),
        reference: item,
        label: getEntityName(item),
        value: item.id,
      };
    });

    const defaultValue = relatedMetrics.map((item) => item.id);
    const visibleRelatedMetrics = relatedMetrics.slice(0, 5);
    const hiddenRelatedMetrics = relatedMetrics.slice(5);

    return {
      initialOptions,
      defaultValue,
      visibleRelatedMetrics,
      hiddenRelatedMetrics,
      relatedMetrics,
    };
  }, [metricDetails]);

  const showMoreLessElement = useMemo(() => {
    return (
      <Typography.Text
        className="cursor-pointer text-xs text-primary underline"
        data-testid={`show-${isShowMore ? 'less' : 'more'}`}
        onClick={() => setIsShowMore(!isShowMore)}>
        {isShowMore ? t('label.show-less') : t('label.show-more')}
      </Typography.Text>
    );
  }, [isShowMore, hiddenRelatedMetrics]);

  const getRelatedMetricListing = useCallback(
    (relatedMetrics: EntityReference[]) => {
      return relatedMetrics.map((item) => {
        return (
          <div
            className="right-panel-list-item flex items-center justify-between"
            data-testid={getEntityName(item)}
            key={item.id}>
            <div className="flex items-center">
              <Link
                className="font-medium"
                to={entityUtilClassBase.getEntityLink(
                  item.type,
                  item.fullyQualifiedName ?? ''
                )}>
                <Button
                  className="metric-entity-button flex-center p-0 m--ml-1"
                  icon={
                    <div className="entity-button-icon m-r-xs">
                      {getEntityIcon(item.type)}
                    </div>
                  }
                  title={getEntityName(item)}
                  type="text">
                  <Typography.Text
                    className="w-72 text-left text-xs"
                    ellipsis={{ tooltip: true }}>
                    {getEntityName(item)}
                  </Typography.Text>
                </Button>
              </Link>
            </div>
          </div>
        );
      });
    },
    []
  );

  const handleRelatedMetricUpdate = useCallback(
    async (updatedAssets: DataAssetOption[]) => {
      try {
        const updatedRelatedMetrics = updatedAssets.map(
          (item) => item.reference
        );

        const updateMetricData = {
          ...metricDetails,
          relatedMetrics: updatedRelatedMetrics,
        };

        await onMetricUpdate?.(updateMetricData, 'relatedMetrics');
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    },
    [onMetricUpdate, relatedMetrics]
  );

  const header = (
    <Space className="w-full items-center">
      <Typography.Text
        className={classNames({
          'text-sm font-medium': newLook,
          'right-panel-label': !newLook,
        })}
        data-testid="header-label">
        {t('label.related-metric-plural')}
      </Typography.Text>
      {!isEdit &&
        !isEmpty(relatedMetrics) &&
        permissions.EditAll &&
        !metricDetails.deleted && (
          <EditIconButton
            data-testid="edit-related-metrics"
            newLook={newLook}
            size="small"
            onClick={() => setIsEdit(true)}
          />
        )}
    </Space>
  );

  const content = (
    <>
      {isEmpty(relatedMetrics) &&
        !isEdit &&
        permissions.EditAll &&
        !metricDetails.deleted && (
          <Col
            className="m-t-xss"
            data-testid="add-related-metrics-container"
            onClick={() => setIsEdit(true)}>
            <TagsV1 startWith={TAG_START_WITH.PLUS} tag={TAG_CONSTANT} />
          </Col>
        )}
      <Col span={24}>
        {isEdit ? (
          <RelatedMetricsForm
            defaultValue={defaultValue}
            initialOptions={initialOptions}
            metricFqn={metricDetails.fullyQualifiedName ?? ''}
            onCancel={() => setIsEdit(false)}
            onSubmit={handleRelatedMetricUpdate}
          />
        ) : (
          <>
            {isEmpty(relatedMetrics) &&
            (metricDetails.deleted || isInSummaryPanel) ? (
              <Typography.Text>{NO_DATA_PLACEHOLDER}</Typography.Text>
            ) : (
              <div
                className="metric-entity-list-body"
                data-testid="metric-entity-list-body">
                {getRelatedMetricListing(visibleRelatedMetrics)}
                {isShowMore && getRelatedMetricListing(hiddenRelatedMetrics)}
                {!isEmpty(hiddenRelatedMetrics) && showMoreLessElement}
              </div>
            )}
          </>
        )}
      </Col>
    </>
  );

  if (newLook) {
    return (
      <Card className="new-header-border-card" title={header}>
        <Row gutter={[0, 8]}>{content}</Row>
      </Card>
    );
  }

  return (
    <Row gutter={[0, 8]}>
      <Col span={24}>{header}</Col>
      {content}
    </Row>
  );
};

export default RelatedMetrics;
