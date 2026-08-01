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
import { Button } from '@openmetadata/ui-core-components';
import { t } from './i18next/LocalUtil';

export const renderQueryBuilderFilterButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <Button
        className="action action--DELETE"
        data-testid="delete-condition-button"
        onClick={props?.onClick}
        color='secondary'
        iconLeading={<CloseOutlined />} />
    );
  } else if (type === 'delRuleGroup') {
    return (
      <Button
        className="action action--DELETE-GROUP"
        data-testid="delete-group-condition-button"
        onClick={props?.onClick}
        color='secondary'
        iconLeading={<CloseOutlined />} />
    );
  } else if (type === 'addRule') {
    return (
      <Button
        className="action action--ADD-RULE"
        data-testid="add-condition-button"
        onClick={props?.onClick}
        color='primary'>
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
          onClick={props?.onClick}
          color='secondary'
          iconLeading={<CloseOutlined width={14} />} />
      );
    } else if (type === 'delRuleGroup') {
      return (
        <Button
          className="action action--DELETE-GROUP ant-btn-sm"
          data-testid="delete-group-condition-button"
          onClick={props?.onClick}
          color='secondary'
          iconLeading={<CloseOutlined width={14} />} />
      );
    } else if (type === 'addRule') {
      return (
        <Button
          className="action action--ADD-RULE ant-btn-sm"
          data-testid="add-condition-button"
          onClick={props?.onClick}
          color='primary'
          iconLeading={<PlusOutlined width={14} />}
        />
      );
    }

    return <></>;
  };
