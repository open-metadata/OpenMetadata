/*
 *  Copyright 2026 Collate.
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
import { Plus, Trash01, X } from '@untitledui/icons';
import { FC } from 'react';
import { t } from '../../../../utils/i18next/LocalUtil';
import type {
  QueryBuilderButtonKind,
  QueryBuilderButtonProps,
} from './QueryBuilderButton.types';

const DELETE_ICON_CLASSES =
  'action action--DELETE tw:cursor-pointer tw:text-fg-quaternary tw:hover:text-fg-error-primary';

/**
 * Every add/delete affordance RAQB asks a builder to render.
 *
 * One component replaces four near-identical renderers that differed only in
 * testids, icon size and whether the add button carried a label — and one of
 * which (Collate's) had no group delete at all, leaving a loaded nested tree
 * unremovable.
 */
const QueryBuilderButton: FC<QueryBuilderButtonProps> = ({
  preset,
  buttonProps,
}) => {
  const kind = buttonProps?.type as QueryBuilderButtonKind | undefined;

  if (!buttonProps || !kind) {
    return <></>;
  }

  if (kind === 'delRule' || kind === 'delRuleGroup') {
    return (
      <X
        className={`${DELETE_ICON_CLASSES} ${preset.iconClassName}`}
        data-testid={preset.testIds[kind]}
        onClick={buttonProps.onClick}
      />
    );
  }

  if (kind === 'delGroup') {
    return (
      <Trash01
        className={`action action--DELETE tw:cursor-pointer tw:text-fg-error-primary ${preset.iconClassName}`}
        data-testid={preset.testIds.delGroup}
        onClick={buttonProps.onClick as () => void}
      />
    );
  }

  if (kind === 'addRule' || kind === 'addGroup') {
    const label = preset.addRuleLabel?.();

    return (
      <Button
        // RAQB nests this inside its own action markup, where
        // name-from-contents can compute empty — and the icon-only variant has
        // no text at all. Either way the button becomes unfindable by role,
        // for tests and assistive tech alike.
        aria-label={
          label ?? t('label.add-entity', { entity: t('label.condition') })
        }
        className={`action action--${
          kind === 'addRule' ? 'ADD-RULE' : 'ADD-GROUP'
        }`}
        color="secondary"
        data-testid={preset.testIds[kind]}
        iconLeading={Plus}
        size="sm"
        onPress={() => buttonProps.onClick?.()}>
        {label}
      </Button>
    );
  }

  return <></>;
};

/**
 * Adapts the component to RAQB's `settings.renderButton` callback shape.
 */
export const createQueryBuilderButtons = (
  preset: QueryBuilderButtonProps['preset']
): RenderSettings['renderButton'] =>
  ((buttonProps) => (
    <QueryBuilderButton buttonProps={buttonProps} preset={preset} />
  )) as RenderSettings['renderButton'];

export default QueryBuilderButton;
