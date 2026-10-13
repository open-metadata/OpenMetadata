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
import { cx } from '@/utils/cx';
import { Skeleton, type SkeletonAnimation } from './skeleton';

export interface SkeletonParagraphProps {
  /** Number of paragraph lines below the title. @default 3 */
  rows?: number;
  /** Whether to render a shorter title line above the rows. @default true */
  title?: boolean;
  className?: string;
  /** @default "pulse" */
  animation?: SkeletonAnimation;
}

export const SkeletonParagraph = ({
  rows = 3,
  title = true,
  className,
  animation = 'pulse',
}: SkeletonParagraphProps) => (
  <div className={cx('tw:flex tw:w-full tw:flex-col tw:gap-3', className)}>
    {title && <Skeleton animation={animation} height={16} width="40%" />}
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton
        animation={animation}
        key={index}
        width={index === rows - 1 ? '60%' : '100%'}
      />
    ))}
  </div>
);
