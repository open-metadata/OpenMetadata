import type { SVGProps } from "react";
import { cx } from "@/utils/cx";

export const Grid = (props: Omit<SVGProps<SVGSVGElement>, "size"> & { size?: "sm" | "md" | "lg" }) => {
    const { size = "lg", className } = props;
    const Pattern = sizes[size];

    return <Pattern className={className} />;
};

const lg = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="768" height="768" viewBox="0 0 768 768" fill="none" {...props} className={cx("text-border-secondary", props.className)}>
            <mask id="mask0_4933_393109" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="768" height="768">
                <rect width="768" height="768" fill="url(#paint0_radial_4933_393109)" />
            </mask>
            <g mask="url(#mask0_4933_393109)">
                <g clipPath="url(#clip0_4933_393109)">
                    <g clipPath="url(#clip1_4933_393109)">
                        <line x1="0.5" x2="0.5" y2="768" stroke="currentColor" />
                        <line x1="48.5" x2="48.5" y2="768" stroke="currentColor" />
                        <line x1="96.5" x2="96.5" y2="768" stroke="currentColor" />
                        <line x1="144.5" x2="144.5" y2="768" stroke="currentColor" />
                        <line x1="192.5" x2="192.5" y2="768" stroke="currentColor" />
                        <line x1="240.5" x2="240.5" y2="768" stroke="currentColor" />
                        <line x1="288.5" x2="288.5" y2="768" stroke="currentColor" />
                        <line x1="336.5" x2="336.5" y2="768" stroke="currentColor" />
                        <line x1="384.5" x2="384.5" y2="768" stroke="currentColor" />
                        <line x1="432.5" x2="432.5" y2="768" stroke="currentColor" />
                        <line x1="480.5" x2="480.5" y2="768" stroke="currentColor" />
                        <line x1="528.5" x2="528.5" y2="768" stroke="currentColor" />
                        <line x1="576.5" x2="576.5" y2="768" stroke="currentColor" />
                        <line x1="624.5" x2="624.5" y2="768" stroke="currentColor" />
                        <line x1="672.5" x2="672.5" y2="768" stroke="currentColor" />
                        <line x1="720.5" x2="720.5" y2="768" stroke="currentColor" />
                    </g>
                    <rect x="0.5" y="0.5" width="767" height="767" stroke="currentColor" />
                    <g clipPath="url(#clip2_4933_393109)">
                        <line y1="47.5" x2="768" y2="47.5" stroke="currentColor" />
                        <line y1="95.5" x2="768" y2="95.5" stroke="currentColor" />
                        <line y1="143.5" x2="768" y2="143.5" stroke="currentColor" />
                        <line y1="191.5" x2="768" y2="191.5" stroke="currentColor" />
                        <line y1="239.5" x2="768" y2="239.5" stroke="currentColor" />
                        <line y1="287.5" x2="768" y2="287.5" stroke="currentColor" />
                        <line y1="335.5" x2="768" y2="335.5" stroke="currentColor" />
                        <line y1="383.5" x2="768" y2="383.5" stroke="currentColor" />
                        <line y1="431.5" x2="768" y2="431.5" stroke="currentColor" />
                        <line y1="479.5" x2="768" y2="479.5" stroke="currentColor" />
                        <line y1="527.5" x2="768" y2="527.5" stroke="currentColor" />
                        <line y1="575.5" x2="768" y2="575.5" stroke="currentColor" />
                        <line y1="623.5" x2="768" y2="623.5" stroke="currentColor" />
                        <line y1="671.5" x2="768" y2="671.5" stroke="currentColor" />
                        <line y1="719.5" x2="768" y2="719.5" stroke="currentColor" />
                        <line y1="767.5" x2="768" y2="767.5" stroke="currentColor" />
                    </g>
                    <rect x="0.5" y="0.5" width="767" height="767" stroke="currentColor" />
                </g>
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4933_393109"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(384 384) rotate(90) scale(384 384)"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </radialGradient>
                <clipPath id="clip0_4933_393109">
                    <rect width="768" height="768" fill="white" />
                </clipPath>
                <clipPath id="clip1_4933_393109">
                    <rect width="768" height="768" fill="white" />
                </clipPath>
                <clipPath id="clip2_4933_393109">
                    <rect width="768" height="768" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};

const md = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="480" height="480" viewBox="0 0 480 480" {...props} fill="none" className={cx("text-border-secondary", props.className)}>
            <mask id="mask0_4933_393121" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="480">
                <rect width="480" height="480" fill="url(#paint0_radial_4933_393121)" />
            </mask>
            <g mask="url(#mask0_4933_393121)">
                <g clipPath="url(#clip0_4933_393121)">
                    <g clipPath="url(#clip1_4933_393121)">
                        <line x1="0.5" x2="0.5" y2="480" stroke="currentColor" />
                        <line x1="32.5" x2="32.5" y2="480" stroke="currentColor" />
                        <line x1="64.5" x2="64.5" y2="480" stroke="currentColor" />
                        <line x1="96.5" x2="96.5" y2="480" stroke="currentColor" />
                        <line x1="128.5" x2="128.5" y2="480" stroke="currentColor" />
                        <line x1="160.5" x2="160.5" y2="480" stroke="currentColor" />
                        <line x1="192.5" x2="192.5" y2="480" stroke="currentColor" />
                        <line x1="224.5" x2="224.5" y2="480" stroke="currentColor" />
                        <line x1="256.5" x2="256.5" y2="480" stroke="currentColor" />
                        <line x1="288.5" x2="288.5" y2="480" stroke="currentColor" />
                        <line x1="320.5" x2="320.5" y2="480" stroke="currentColor" />
                        <line x1="352.5" x2="352.5" y2="480" stroke="currentColor" />
                        <line x1="384.5" x2="384.5" y2="480" stroke="currentColor" />
                        <line x1="416.5" x2="416.5" y2="480" stroke="currentColor" />
                        <line x1="448.5" x2="448.5" y2="480" stroke="currentColor" />
                    </g>
                    <rect x="0.5" y="0.5" width="479" height="479" stroke="currentColor" />
                    <g clipPath="url(#clip2_4933_393121)">
                        <line y1="31.5" x2="480" y2="31.5" stroke="currentColor" />
                        <line y1="63.5" x2="480" y2="63.5" stroke="currentColor" />
                        <line y1="95.5" x2="480" y2="95.5" stroke="currentColor" />
                        <line y1="127.5" x2="480" y2="127.5" stroke="currentColor" />
                        <line y1="159.5" x2="480" y2="159.5" stroke="currentColor" />
                        <line y1="191.5" x2="480" y2="191.5" stroke="currentColor" />
                        <line y1="223.5" x2="480" y2="223.5" stroke="currentColor" />
                        <line y1="255.5" x2="480" y2="255.5" stroke="currentColor" />
                        <line y1="287.5" x2="480" y2="287.5" stroke="currentColor" />
                        <line y1="319.5" x2="480" y2="319.5" stroke="currentColor" />
                        <line y1="351.5" x2="480" y2="351.5" stroke="currentColor" />
                        <line y1="383.5" x2="480" y2="383.5" stroke="currentColor" />
                        <line y1="415.5" x2="480" y2="415.5" stroke="currentColor" />
                        <line y1="447.5" x2="480" y2="447.5" stroke="currentColor" />
                        <line y1="479.5" x2="480" y2="479.5" stroke="currentColor" />
                    </g>
                    <rect x="0.5" y="0.5" width="479" height="479" stroke="currentColor" />
                </g>
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4933_393121"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(240 240) rotate(90) scale(240 240)"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </radialGradient>
                <clipPath id="clip0_4933_393121">
                    <rect width="480" height="480" fill="white" />
                </clipPath>
                <clipPath id="clip1_4933_393121">
                    <rect width="480" height="480" fill="white" />
                </clipPath>
                <clipPath id="clip2_4933_393121">
                    <rect width="480" height="480" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};

const sm = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="336" height="336" viewBox="0 0 336 336" {...props} fill="none" className={cx("text-border-secondary", props.className)}>
            <mask id="mask0_4947_375939" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="336" height="336">
                <rect width="336" height="336" fill="url(#paint0_radial_4947_375939)" />
            </mask>
            <g mask="url(#mask0_4947_375939)">
                <g clipPath="url(#clip0_4947_375939)">
                    <g clipPath="url(#clip1_4947_375939)">
                        <line x1="0.5" x2="0.5" y2="336" stroke="currentColor" />
                        <line x1="24.5" x2="24.5" y2="336" stroke="currentColor" />
                        <line x1="48.5" x2="48.5" y2="336" stroke="currentColor" />
                        <line x1="72.5" x2="72.5" y2="336" stroke="currentColor" />
                        <line x1="96.5" x2="96.5" y2="336" stroke="currentColor" />
                        <line x1="120.5" x2="120.5" y2="336" stroke="currentColor" />
                        <line x1="144.5" x2="144.5" y2="336" stroke="currentColor" />
                        <line x1="168.5" x2="168.5" y2="336" stroke="currentColor" />
                        <line x1="192.5" x2="192.5" y2="336" stroke="currentColor" />
                        <line x1="216.5" x2="216.5" y2="336" stroke="currentColor" />
                        <line x1="240.5" x2="240.5" y2="336" stroke="currentColor" />
                        <line x1="264.5" x2="264.5" y2="336" stroke="currentColor" />
                        <line x1="288.5" x2="288.5" y2="336" stroke="currentColor" />
                        <line x1="312.5" x2="312.5" y2="336" stroke="currentColor" />
                    </g>
                    <rect x="0.5" y="0.5" width="335" height="335" stroke="currentColor" />
                    <g clipPath="url(#clip2_4947_375939)">
                        <line y1="23.5" x2="336" y2="23.5" stroke="currentColor" />
                        <line y1="47.5" x2="336" y2="47.5" stroke="currentColor" />
                        <line y1="71.5" x2="336" y2="71.5" stroke="currentColor" />
                        <line y1="95.5" x2="336" y2="95.5" stroke="currentColor" />
                        <line y1="119.5" x2="336" y2="119.5" stroke="currentColor" />
                        <line y1="143.5" x2="336" y2="143.5" stroke="currentColor" />
                        <line y1="167.5" x2="336" y2="167.5" stroke="currentColor" />
                        <line y1="191.5" x2="336" y2="191.5" stroke="currentColor" />
                        <line y1="215.5" x2="336" y2="215.5" stroke="currentColor" />
                        <line y1="239.5" x2="336" y2="239.5" stroke="currentColor" />
                        <line y1="263.5" x2="336" y2="263.5" stroke="currentColor" />
                        <line y1="287.5" x2="336" y2="287.5" stroke="currentColor" />
                        <line y1="311.5" x2="336" y2="311.5" stroke="currentColor" />
                        <line y1="335.5" x2="336" y2="335.5" stroke="currentColor" />
                    </g>
                    <rect x="0.5" y="0.5" width="335" height="335" stroke="currentColor" />
                </g>
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4947_375939"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(168 168) rotate(90) scale(168 168)"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </radialGradient>
                <clipPath id="clip0_4947_375939">
                    <rect width="336" height="336" fill="white" />
                </clipPath>
                <clipPath id="clip1_4947_375939">
                    <rect width="336" height="336" fill="white" />
                </clipPath>
                <clipPath id="clip2_4947_375939">
                    <rect width="336" height="336" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};

const sizes = {
    sm,
    md,
    lg,
};
