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
import { Button } from '@openmetadata/ui-core-components';
import type { RenderSettings } from '@react-awesome-query-builder/antd';
import { t } from './i18next/LocalUtil';

export const renderQueryBuilderFilterButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <Button
        className="action action--DELETE"
        color="secondary"
        data-testid="delete-condition-button"
        iconLeading={<CloseOutlined />}
        onClick={props?.onClick}
      />
    );
  } else if (type === 'delRuleGroup') {
    return (
      <Button
        className="action action--DELETE-GROUP"
        color="secondary"
        data-testid="delete-group-condition-button"
        iconLeading={<CloseOutlined />}
        onClick={props?.onClick}
      />
    );
  } else if (type === 'addRule') {
    return (
      <Button
        className="action action--ADD-RULE"
        color="primary"
        data-testid="add-condition-button"
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
          color="secondary"
          data-testid="delete-condition-button"
          iconLeading={<CloseOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    } else if (type === 'delRuleGroup') {
      return (
        <Button
          className="action action--DELETE-GROUP ant-btn-sm"
          color="secondary"
          data-testid="delete-group-condition-button"
          iconLeading={<CloseOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    } else if (type === 'addRule') {
      return (
        <Button
          className="action action--ADD-RULE ant-btn-sm"
          color="primary"
          data-testid="add-condition-button"
          iconLeading={<PlusOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    }

    return <></>;
  };
