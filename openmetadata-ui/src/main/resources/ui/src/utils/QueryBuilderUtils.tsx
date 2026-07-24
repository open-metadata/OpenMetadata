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
import { Button } from '@openmetadata/ui-core-components';
import type { RenderSettings } from '@react-awesome-query-builder/ui';
import { Plus, X } from '@untitledui/icons';
import { t } from './i18next/LocalUtil';

export const renderQueryBuilderFilterButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <X
        className="action action--DELETE tw:size-4 tw:cursor-pointer tw:text-fg-quaternary tw:hover:text-fg-error-primary"
        data-testid="delete-condition-button"
        onClick={props?.onClick}
      />
    );
  }

  if (type === 'delRuleGroup') {
    return (
      <X
        className="action action--DELETE-GROUP tw:size-4 tw:cursor-pointer tw:text-fg-quaternary tw:hover:text-fg-error-primary"
        data-testid="delete-group-condition-button"
        onClick={props?.onClick}
      />
    );
  }

  if (type === 'addRule') {
    return (
      <Button
        // Explicit label: RAQB nests this inside its own action markup and
        // name-from-contents can compute empty there, making the button
        // unfindable by role for tests and assistive tech alike.
        aria-label={t('label.add-entity', { entity: t('label.condition') })}
        className="action action--ADD-RULE"
        color="secondary"
        data-testid="add-condition-button"
        iconLeading={Plus}
        size="sm"
        onPress={() => props?.onClick?.()}>
        {t('label.add-entity', { entity: t('label.condition') })}
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
        <X
          className="action action--DELETE tw:size-3.5 tw:cursor-pointer tw:text-fg-quaternary tw:hover:text-fg-error-primary"
          data-testid="delete-condition-button"
          onClick={props?.onClick}
        />
      );
    }

    if (type === 'delRuleGroup') {
      return (
        <X
          className="action action--DELETE-GROUP tw:size-3.5 tw:cursor-pointer tw:text-fg-quaternary tw:hover:text-fg-error-primary"
          data-testid="delete-group-condition-button"
          onClick={props?.onClick}
        />
      );
    }

    if (type === 'addRule') {
      return (
        <Button
          // Icon-only button: without a label it has no accessible name at
          // all — invisible to role queries and assistive tech.
          aria-label={t('label.add-entity', { entity: t('label.condition') })}
          className="action action--ADD-RULE"
          color="secondary"
          data-testid="add-condition-button"
          iconLeading={Plus}
          size="sm"
          onPress={() => props?.onClick?.()}
        />
      );
    }

    return <></>;
  };
