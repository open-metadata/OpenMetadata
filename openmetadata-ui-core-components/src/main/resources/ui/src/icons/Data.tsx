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

export const Data: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M17.667 18.333c.233 0 .35 0 .439-.046a.4.4 0 0 0 .182-.182c.045-.088.045-.205.045-.438V9c0-.233 0-.35-.046-.439a.4.4 0 0 0-.182-.182c-.088-.046-.205-.046-.438-.046h-2c-.233 0-.35 0-.439.046a.4.4 0 0 0-.182.182C15 8.65 15 8.767 15 9v2c0 .233 0 .35-.046.439a.4.4 0 0 1-.182.182c-.089.046-.205.046-.439.046h-2c-.233 0-.35 0-.439.046a.4.4 0 0 0-.182.182c-.045.088-.045.205-.045.438v2c0 .233 0 .35-.046.439a.4.4 0 0 1-.182.182C11.35 15 11.233 15 11 15H9c-.233 0-.35 0-.439.046a.4.4 0 0 0-.182.182c-.046.089-.046.205-.046.439v2c0 .233 0 .35.046.439a.4.4 0 0 0 .182.182c.089.046.206.046.439.046h8.667ZM8.333 5.667c0-.233 0-.35.046-.439a.4.4 0 0 1 .182-.182C8.65 5 8.767 5 9 5h2c.233 0 .35 0 .439.045a.4.4 0 0 1 .182.183c.046.089.046.205.046.439v2c0 .233 0 .35-.046.439a.4.4 0 0 1-.182.182c-.089.045-.206.045-.439.045H9c-.233 0-.35 0-.439-.046a.4.4 0 0 1-.182-.182c-.046-.088-.046-.205-.046-.438zm-5.833 5c0-.233 0-.35.045-.439a.4.4 0 0 1 .183-.182C2.817 10 2.933 10 3.167 10h2c.233 0 .35 0 .439.046a.4.4 0 0 1 .182.182c.045.089.045.205.045.439v2c0 .233 0 .35-.045.439a.4.4 0 0 1-.182.182c-.089.045-.206.045-.439.045h-2c-.233 0-.35 0-.439-.046a.4.4 0 0 1-.182-.182c-.046-.088-.046-.205-.046-.438zm-.833-8.333c0-.233 0-.35.045-.439a.4.4 0 0 1 .183-.182c.088-.046.205-.046.438-.046h2c.233 0 .35 0 .439.045a.4.4 0 0 1 .182.183C5 1.983 5 2.1 5 2.333v2c0 .233 0 .35-.045.439a.4.4 0 0 1-.182.182C4.683 5 4.567 5 4.333 5h-2c-.233 0-.35 0-.439-.045a.4.4 0 0 1-.182-.182c-.045-.09-.045-.206-.045-.44z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Data.displayName = 'Data';
