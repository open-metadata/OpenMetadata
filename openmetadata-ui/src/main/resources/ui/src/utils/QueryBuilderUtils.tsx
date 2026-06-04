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
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { RenderSettings } from '@react-awesome-query-builder/antd';
import { Button } from 'antd';
import { t } from './i18next/LocalUtil';

export {
  addEntityTypeFilter,
  buildExploreUrlParams,
  elasticsearchToJsonLogic,
  getCommonFieldProperties,
  getEntityTypeAggregationFilter,
  getEqualFieldProperties,
  getFieldsByKeys,
  getJsonTreeFromQueryFilter,
  getJsonTreePropertyFromQueryFilter,
  getOperator,
  getSelectAnyInProperties,
  getSelectEqualsNotEqualsProperties,
  getSelectNotAnyInProperties,
  jsonLogicToElasticsearch,
  JSONLOGIC_FIELDS_TO_IGNORE_SPLIT,
  JSONLOGIC_OPERATORS,
  migrateJsonLogic,
  READONLY_SETTINGS,
  resolveFieldType,
  type ElasticsearchQuery,
  type JsonLogic,
} from './QueryBuilderPureUtils';

export const renderQueryBuilderFilterButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <Button
        className="action action--DELETE"
        data-testid="delete-condition-button"
        icon={<CloseOutlined />}
        onClick={props?.onClick}
      />
    );
  } else if (type === 'delRuleGroup') {
    return (
      <Button
        className="action action--DELETE-GROUP"
        data-testid="delete-group-condition-button"
        icon={<CloseOutlined />}
        onClick={props?.onClick}
      />
    );
  } else if (type === 'addRule') {
    return (
      <Button
        className="action action--ADD-RULE"
        data-testid="add-condition-button"
        type="primary"
        onClick={props?.onClick}>
        {t('label.add-entity', {
          entity: t('label.condition'),
        })}
      </Button>
    );
  }

  return <></>;
};

export const renderJSONLogicQueryBuilderButtons: RenderSettings['renderButton'] =
  (props) => {
    const type = props?.type;

    if (type === 'delRule') {
      return (
        <Button
          className="action action--DELETE ant-btn-sm"
          data-testid="delete-condition-button"
          icon={<CloseOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    } else if (type === 'delRuleGroup') {
      return (
        <Button
          className="action action--DELETE-GROUP ant-btn-sm"
          data-testid="delete-group-condition-button"
          icon={<CloseOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    } else if (type === 'addRule') {
      return (
        <Button
          className="action action--ADD-RULE ant-btn-sm"
          data-testid="add-condition-button"
          icon={<PlusOutlined width={14} />}
          type="primary"
          onClick={props?.onClick}
        />
      );
    }

    return <></>;
  };
