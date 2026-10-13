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

export const ColumnCustomize: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      clipRule="evenodd"
      d="M4.9 3h-.02c-.403 0-.735 0-1.006.022-.281.023-.54.072-.782.196a2 2 0 0 0-.874.874c-.124.243-.173.501-.196.782C2 5.144 2 5.477 2 5.88v10.24c0 .403 0 .735.022 1.006.023.281.072.54.196.782a2 2 0 0 0 .874.874c.243.124.501.173.782.196.27.022.603.022 1.005.022H9a.5.5 0 0 0 0-1H8V9h13v1.5a.5.5 0 0 0 1 0V5.88c0-.403 0-.735-.022-1.006-.023-.281-.072-.54-.196-.782a2 2 0 0 0-.874-.874c-.243-.124-.501-.173-.782-.196C19.856 3 19.523 3 19.12 3zM7 9v9H4.9c-.428 0-.72 0-.944-.019-.22-.018-.332-.05-.41-.09a1 1 0 0 1-.437-.437c-.04-.078-.072-.19-.09-.41A13 13 0 0 1 3 16.1V9zm0-1H3V5.9c0-.428 0-.72.019-.944.018-.22.05-.332.09-.41a1 1 0 0 1 .437-.437c.078-.04.19-.072.41-.09C4.18 4 4.472 4 4.9 4H7zm1 0V4h11.1c.428 0 .72 0 .944.019.22.018.332.05.41.09a1 1 0 0 1 .437.437c.04.078.072.19.09.41.019.225.019.516.019.944V8zm7.5 3a.5.5 0 0 0-.447.276l-.82 1.642-1.612-.403a.5.5 0 0 0-.568.261l-1 2a.5.5 0 0 0 .093.578l1.147 1.146-1.147 1.146a.5.5 0 0 0-.093.578l1 2a.5.5 0 0 0 .568.261l1.611-.403.82 1.642A.5.5 0 0 0 15.5 22h2a.5.5 0 0 0 .447-.276l.82-1.642 1.612.403a.5.5 0 0 0 .568-.261l1-2a.5.5 0 0 0-.093-.578L20.707 16.5l1.147-1.146a.5.5 0 0 0 .093-.578l-1-2a.5.5 0 0 0-.568-.261l-1.611.403-.82-1.642A.5.5 0 0 0 17.5 11zm-.553 2.724L15.81 12h1.382l.862 1.724a.5.5 0 0 0 .568.261l1.611-.403.66 1.32-1.246 1.244a.5.5 0 0 0 0 .708l1.246 1.245-.66 1.319-1.61-.403a.5.5 0 0 0-.57.261L17.192 21H15.81l-.862-1.724a.5.5 0 0 0-.568-.261l-1.611.403-.66-1.32 1.246-1.244a.5.5 0 0 0 0-.708l-1.246-1.245.66-1.319 1.61.403a.5.5 0 0 0 .57-.261M16 16.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0m.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);
ColumnCustomize.displayName = 'ColumnCustomize';
