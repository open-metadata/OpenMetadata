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
import { borderAfter } from '@openmetadata/ui-core-components';
import classNames from 'classnames';

/**
 * The design's segmented control, laid over core's `button-border` tabs: a
 * borderless gray track with the chosen option raised on it, every option
 * 12px semibold. Core has no such tab type yet, so the landing page carries it.
 */
export const SEGMENTED_TAB_LIST_CLASSES = 'tw:bg-tertiary tw:outline-0';

export const getSegmentedTabClasses = ({
  isSelected,
}: {
  isSelected: boolean;
}) =>
  classNames(
    'tw:rounded-lg tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold',
    isSelected
      ? `tw:bg-primary_alt tw:text-primary tw:shadow-xs ${borderAfter} tw:after:outline-secondary`
      : 'tw:bg-transparent tw:text-tertiary tw:shadow-none tw:hover:text-secondary'
  );
