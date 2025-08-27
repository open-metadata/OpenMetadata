import type { SVGProps } from "react";
import { cx } from "@/utils/cx";
import { Circle } from "./circle";
import { Grid } from "./grid";
import { GridCheck } from "./grid-check";
import { Square } from "./square";

const patterns = {
    circle: Circle,
    square: Square,
    grid: Grid,
    "grid-check": GridCheck,
};

export interface BackgroundPatternProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
    size?: "sm" | "md" | "lg";
    pattern: keyof typeof patterns;
}

export const BackgroundPattern = (props: BackgroundPatternProps) => {
    const { pattern } = props;
    const Pattern = patterns[pattern];

    return <Pattern {...props} size={props.size as "sm" | "md"} className={cx("pointer-events-none", props.className)} />;
};
