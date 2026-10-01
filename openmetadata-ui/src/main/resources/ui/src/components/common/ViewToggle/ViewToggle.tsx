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

import { ButtonGroup, ButtonGroupItem } from '@openmetadata/ui-core-components';
import { Grid01, Menu01 } from '@untitledui/icons';
import { FC } from 'react';
import { ReactComponent as WorkflowIcon } from '../../../assets/svg/data-flow.svg';
import { PageViewMode } from '../../../generated/type/personaPreferences';

interface ViewToggleProps {
  value: PageViewMode;
  onChange: (view: PageViewMode) => void;
  views?: PageViewMode[];
}

const DEFAULT_VIEWS: PageViewMode[] = [PageViewMode.Table, PageViewMode.Card];

const getIconElement = (mode: PageViewMode, isActive: boolean) => {
  const iconClass = `tw:size-4 ${
    isActive ? 'tw:text-fg-brand-primary' : 'tw:text-fg-secondary'
  }`;
  switch (mode) {
    case PageViewMode.Card:
      return <Grid01 className={iconClass} />;
    case PageViewMode.Tree:
      return <WorkflowIcon aria-label="Tree view" className={iconClass} />;
    case PageViewMode.Table:
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
      disallowEmptySelection
      selectedKeys={new Set([value])}
      size="sm"
      onSelectionChange={(keys) => {
        const selected = Array.from(keys as Set<string>)[0] as PageViewMode;
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
