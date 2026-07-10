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

import {
  ButtonGroup,
  ButtonGroupItem,
} from '@openmetadata/ui-core-components';
import { Grid01, Menu01 } from '@untitledui/icons';
import { FC } from 'react';
import { ReactComponent as WorkflowIcon } from '../../../assets/svg/data-flow.svg';

export type ViewMode = 'table' | 'card' | 'tree';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
  views?: ViewMode[];
}

const DEFAULT_VIEWS: ViewMode[] = ['table', 'card'];

const getIconElement = (mode: ViewMode, isActive: boolean) => {
  const iconClass = `tw:size-4 ${isActive ? 'tw:text-fg-brand-primary' : 'tw:text-fg-secondary'}`;
  switch (mode) {
    case 'card':
      return <Grid01 className={iconClass} />;
    case 'tree':
      return <WorkflowIcon aria-label="Tree view" className={iconClass} />;
    case 'table':
    default:
      return <Menu01 className={iconClass} />;
  }
};

const ViewToggle: FC<ViewToggleProps> = ({
  value,
  onChange,
  views = DEFAULT_VIEWS,
}) => {
  const availableViews = views.length > 0 ? views : DEFAULT_VIEWS;

  return (
    <ButtonGroup
      selectedKeys={new Set([value])}
      size="sm"
      onSelectionChange={(keys) => {
        const selected = Array.from(keys as Set<string>)[0] as ViewMode;
        if (selected) {
          onChange(selected);
        }
      }}>
      {availableViews.map((mode) => {
        const isActive = value === mode;

        return (
          <ButtonGroupItem
            aria-label={mode}
            className={isActive ? '!tw:bg-brand-primary' : ''}
            data-testid={`${mode}-view-toggle`}
            iconLeading={getIconElement(mode, isActive)}
            id={mode}
            key={mode}
          />
        );
      })}
    </ButtonGroup>
  );
};

export default ViewToggle;
