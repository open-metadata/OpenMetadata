import type { SVGProps } from "react";
import { cx } from "@/utils/cx";

export const Circle = (props: Omit<SVGProps<SVGSVGElement>, "size"> & { size?: "sm" | "md" | "lg" }) => {
    const { size = "lg", className } = props;
    const Pattern = sizes[size];

    return <Pattern className={className} />;
};

const lg = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="768" height="768" viewBox="0 0 768 768" fill="none" {...props} className={cx("text-border-secondary", props.className)}>
            <mask id="mask0_4933_392997" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="768" height="768">
                <rect width="768" height="768" fill="url(#paint0_radial_4933_392997)" />
            </mask>
            <g mask="url(#mask0_4933_392997)">
                <circle cx="384" cy="384" r="47.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="95.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="143.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="191.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="239.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="287.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="335.5" stroke="currentColor" />
                <circle cx="384" cy="384" r="383.5" stroke="currentColor" />
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4933_392997"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(384 384) rotate(90) scale(384 384)"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </radialGradient>
            </defs>
        </svg>
    );
};

const md = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="480" height="480" viewBox="0 0 480 480" fill="none" {...props} className={cx("text-border-secondary", props.className)}>
            <mask id="mask0_4933_393068" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="480">
                <rect width="480" height="480" fill="url(#paint0_radial_4933_393068)" />
            </mask>
            <g mask="url(#mask0_4933_393068)">
                <circle cx="240" cy="240" r="47.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="79.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="111.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="143.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="143.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="175.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="207.5" stroke="currentColor" />
                <circle cx="240" cy="240" r="239.5" stroke="currentColor" />
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4933_393068"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(240 240) rotate(90) scale(240 240)"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </radialGradient>
            </defs>
        </svg>
    );
};

const sm = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="336" height="336" viewBox="0 0 336 336" fill="none" {...props} className={cx("text-border-secondary", props.className)}>
            <mask id="mask0_4947_375931" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="336" height="336">
                <rect width="336" height="336" fill="url(#paint0_radial_4947_375931)" />
            </mask>
            <g mask="url(#mask0_4947_375931)">
                <circle cx="168" cy="168" r="47.5" stroke="currentColor" />
                <circle cx="168" cy="168" r="47.5" stroke="currentColor" />
                <circle cx="168" cy="168" r="71.5" stroke="currentColor" />
                <circle cx="168" cy="168" r="95.5" stroke="currentColor" />
                <circle cx="168" cy="168" r="119.5" stroke="currentColor" />
                <circle cx="168" cy="168" r="143.5" stroke="currentColor" />
                <circle cx="168" cy="168" r="167.5" stroke="currentColor" />
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4947_375931"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(168 168) rotate(90) scale(168 168)"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </radialGradient>
            </defs>
        </svg>
    );
};

const sizes = {
    sm,
    md,
    lg,
};
