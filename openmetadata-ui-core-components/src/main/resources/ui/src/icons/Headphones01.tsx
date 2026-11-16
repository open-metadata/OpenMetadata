/*
 *  Copyright 2025 Collate.
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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const Headphones01: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M14 11.444c0-.277 0-.415.042-.538.12-.359.44-.497.759-.643.359-.163.538-.245.716-.26.202-.016.405.028.577.124.23.129.389.373.552.571.755.917 1.132 1.375 1.27 1.88a2.35 2.35 0 0 1 0 1.243c-.201.737-.837 1.355-1.308 1.927-.241.293-.361.44-.514.525-.172.096-.375.14-.577.124-.178-.015-.357-.096-.716-.26-.32-.146-.638-.285-.76-.643-.041-.123-.041-.261-.041-.538zm-8 0c0-.349-.01-.662-.291-.906-.103-.09-.238-.151-.51-.275-.359-.163-.539-.245-.716-.26-.534-.043-.821.322-1.13.695-.754.917-1.131 1.375-1.27 1.88a2.35 2.35 0 0 0 0 1.243c.202.738.838 1.355 1.31 1.928.296.36.58.689 1.09.648.177-.015.357-.096.716-.26.272-.124.407-.186.51-.274.281-.245.291-.558.291-.906z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.4 10.402v-1.2c0-3.093-2.866-5.6-6.4-5.6s-6.4 2.507-6.4 5.6v1.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Headphones01.displayName = 'Headphones01';
