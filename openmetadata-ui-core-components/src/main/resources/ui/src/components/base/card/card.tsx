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
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export const Card = ({ className, children, ...props }: CardProps) => {
  return (
    <div
      {...props}
      className={cx(
        "tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:relative tw:overflow-hidden tw:rounded-xl tw:ring-1 tw:ring-inset tw:ring-secondary tw:bg-primary",
        className,
      )}
    >
      {children}
    </div>
  );
};

Card.displayName = "Card";
