/*
 *  Copyright 2021 Collate
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

import React, { FC, HTMLAttributes } from 'react';

export const Paragraph: FC<
  HTMLAttributes<HTMLParagraphElement> & { isNewLine: boolean }
> = ({ children, ...props }) => <p {...props}>{children}</p>;

export const Span: FC<
  HTMLAttributes<HTMLSpanElement> & { isNewLine: boolean }
> = ({ children, ...props }) => <span {...props}>{children}</span>;

export const UnOrderedList: FC<HTMLAttributes<HTMLUListElement>> = ({
  children,
  ...props
}) => <ul {...props}>{children}</ul>;
