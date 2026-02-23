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

import type { ElementType, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "@/utils/cx";

type TypographyQuoteVariant = "default" | "centered-quote" | "minimal-quote";

interface TypographyProps extends HTMLAttributes<HTMLElement> {
    ref?: Ref<HTMLElement>;
    children?: ReactNode;
    as?: ElementType;
    quoteVariant?: TypographyQuoteVariant;
    className?: string;
}

const quoteStyles: Record<TypographyQuoteVariant, string> = {
    default: "",
    "centered-quote": "prose-centered-quote",
    "minimal-quote": "prose-minimal-quote",
};

export const Typography = (props: TypographyProps) => {
    const {
        as: Component = "div",
        quoteVariant = "default",
        className,
        children,
        ...otherProps
    } = props;

    return (
        <Component
            {...otherProps}
            className={cx(
                "prose",
                quoteStyles[quoteVariant],
                className,
            )}
        >
            {children}
        </Component>
    );
};

export type { TypographyProps, TypographyQuoteVariant };
