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
import { t } from '../../../../utils/i18next/LocalUtil';
import type { QueryBuilderButtonPreset } from './QueryBuilderButton.types';

/**
 * Explore advanced search: the only caller with user-created brackets, and so
 * the only one whose addGroup/delGroup testids are driven by Playwright.
 */
export const EXPLORE_BUTTON_PRESET: QueryBuilderButtonPreset = {
  iconClassName: 'tw:size-4',
  addRuleLabel: () => t('label.add'),
  testIds: {
    addRule: 'advanced-search-add-rule',
    delRule: 'advanced-search-delete-rule',
    addGroup: 'advanced-search-add-group',
    delGroup: 'advanced-search-delete-group',
    delRuleGroup: 'advanced-search-delete-rule',
  },
};

/** Form-embedded builders: a labelled "Add condition" button. */
export const CONDITION_BUTTON_PRESET: QueryBuilderButtonPreset = {
  iconClassName: 'tw:size-4',
  addRuleLabel: () => t('label.add-entity', { entity: t('label.condition') }),
  testIds: {
    addRule: 'add-condition-button',
    delRule: 'delete-condition-button',
    addGroup: 'add-group-condition-button',
    delGroup: 'delete-group-condition-button',
    delRuleGroup: 'delete-group-condition-button',
  },
};

/**
 * The same, at the tighter density the JSONLogic builders use.
 *
 * It carries the label too: an icon-only `+` beside a labelled "Add condition"
 * on the next screen reads as two different controls when it is the same one.
 */
export const COMPACT_BUTTON_PRESET: QueryBuilderButtonPreset = {
  iconClassName: 'tw:size-3.5',
  addRuleLabel: CONDITION_BUTTON_PRESET.addRuleLabel,
  testIds: CONDITION_BUTTON_PRESET.testIds,
};
