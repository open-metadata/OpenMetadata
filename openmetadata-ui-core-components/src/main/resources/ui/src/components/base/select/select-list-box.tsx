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
import {
  ListBox,
  ListLayout,
  Virtualizer,
  type ListBoxProps,
} from 'react-aria-components';
import { cx } from '@/utils/cx';
import type { SelectItemType } from './select';

export const SELECT_VIRTUALIZATION_THRESHOLD = 100;
const LAYOUT_OPTIONS = { estimatedRowHeight: 40 };

export const SelectListBox = ({
  virtualize,
  size,
  children,
  ...props
}: ListBoxProps<SelectItemType> & {
  virtualize: boolean;
  size: 'sm' | 'md';
}) => {
  const listBox = (
    <ListBox
      {...props}
      className={cx(
        'tw:size-full tw:outline-hidden',
        virtualize && 'tw:overflow-y-auto tw:py-1',
        virtualize && (size === 'sm' ? 'tw:max-h-64' : 'tw:max-h-80')
      )}>
      {children}
    </ListBox>
  );

  return virtualize ? (
    <Virtualizer layout={ListLayout} layoutOptions={LAYOUT_OPTIONS}>
      {listBox}
    </Virtualizer>
  ) : (
    listBox
  );
};
