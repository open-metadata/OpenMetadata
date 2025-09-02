import type { HTMLAttributes } from "react";
import { UploadCloud02 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface IllustrationProps extends HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "md" | "lg";
    svgClassName?: string;
    childrenClassName?: string;
}

export const BoxIllustration = ({ size = "lg", ...otherProps }: IllustrationProps) => {
    const Pattern = sizes[size];

    return <Pattern {...otherProps} />;
};

export const sm = ({
    className,
    svgClassName,
    childrenClassName,
    children = <UploadCloud02 className="size-6" />,
    ...otherProps
}: Omit<IllustrationProps, "size">) => {
    return (
        <div {...otherProps} className={cx("relative h-31.5 w-38", className)}>
            <svg viewBox="0 0 152 126" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="76" cy="60" r="52" className="fill-utility-gray-100" />
                <circle cx="21" cy="27" r="5" className="fill-utility-gray-100" />
                <circle cx="18" cy="111" r="7" className="fill-utility-gray-100" />
                <circle cx="145" cy="43" r="7" className="fill-utility-gray-100" />
                <circle cx="134" cy="16" r="4" className="fill-utility-gray-100" />
                <g filter="url(#box-shadow-sm)">
                    <path d="M76.0006 92.1898L118 73.5312V20.375L76.3298 2L34 20.375V73.5312L76.0006 92.1898Z" className="fill-utility-gray-50" />
                    <path
                        d="M118.5 73.8564L118.203 73.9883L76.2031 92.6465L76.001 92.7373L75.7979 92.6465L33.7969 73.9883L33.5 73.8564V20.0469L33.8008 19.916L76.1309 1.54102L76.3311 1.4541L76.5312 1.54297L118.202 19.918L118.5 20.0488V73.8564Z"
                        className="stroke-border-secondary_alt"
                    />
                    <path d="M76 38.0629V92.2344L34 73.5312V20.375L76 38.0629Z" className="fill-utility-gray-200" />
                    <path d="M76.0008 38.0938V92.2344L118 73.5312V20.375L76.0008 38.0938Z" fill="url(#box-gradient-sm)" />
                    <path d="M76 38.0938L118 20.375L76.3298 2L34 20.375L76 38.0938Z" className="fill-utility-gray-50" />
                    <path
                        d="M50.0781 13.3943L91.6722 31.4986L92.0523 44.7698L103.759 39.9395L103.405 26.5846L60.4847 8.88196L50.0781 13.3943Z"
                        className="fill-utility-gray-200"
                    />
                </g>
                <defs>
                    <filter
                        id="box-shadow-sm"
                        x="19.875"
                        y="0.908508"
                        width="112.25"
                        height="118.626"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="0.984375" operator="erode" in="SourceAlpha" result="box-shadow-sm-effect1" />
                        <feOffset dy="1.96875" />
                        <feGaussianBlur stdDeviation="0.984375" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="box-shadow-sm-effect1" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="2.625" operator="erode" in="SourceAlpha" result="box-shadow-sm-effect2" />
                        <feOffset dy="5.25" />
                        <feGaussianBlur stdDeviation="2.625" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="box-shadow-sm-effect1" result="box-shadow-sm-effect2" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="2.625" operator="erode" in="SourceAlpha" result="box-shadow-sm-effect3" />
                        <feOffset dy="13.125" />
                        <feGaussianBlur stdDeviation="7.875" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="box-shadow-sm-effect2" result="box-shadow-sm-effect3" />
                        <feBlend mode="normal" in="SourceGraphic" in2="box-shadow-sm-effect3" result="shape" />
                    </filter>
                    <linearGradient id="box-gradient-sm" x1="97" y1="20.375" x2="128.011" y2="74.9366" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-200" />
                    </linearGradient>
                </defs>
            </svg>

            {children && (
                <span
                    className={cx(
                        "absolute inset-x-13 bottom-2 z-10 flex size-12 items-center justify-center rounded-full bg-alpha-black/20 text-fg-white backdrop-blur-xs",
                        childrenClassName,
                    )}
                >
                    {children}
                </span>
            )}
        </div>
    );
};

export const md = ({
    className,
    svgClassName,
    childrenClassName,
    children = <UploadCloud02 className="size-7" />,
    ...otherProps
}: Omit<IllustrationProps, "size">) => {
    return (
        <div {...otherProps} className={cx("relative h-37 w-43", className)}>
            <svg viewBox="0 0 172 148" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="86" cy="74" r="64" className="fill-utility-gray-100" />
                <circle cx="20" cy="30" r="6" className="fill-utility-gray-100" />
                <circle cx="17" cy="122" r="8" className="fill-utility-gray-100" />
                <circle cx="160" cy="46" r="8" className="fill-utility-gray-100" />
                <circle cx="149" cy="19" r="5" className="fill-utility-gray-100" />
                <g filter="url(#box-shadow-md)">
                    <path d="M86.0007 113.664L138 90.5625V24.75L86.4084 2L34 24.75V90.5625L86.0007 113.664Z" className="fill-utility-gray-50" />
                    <path
                        d="M138.5 90.8877L138.203 91.0195L86.2041 114.12L86.001 114.211L85.7979 114.12L33.7969 91.0195L33.5 90.8877V24.4219L33.8008 24.291L86.209 1.54102L86.4102 1.4541L86.6104 1.54297L138.202 24.293L138.5 24.4238V90.8877Z"
                        className="stroke-border-secondary_alt"
                    />
                    <path d="M86 46.6493V113.719L34 90.5625V24.75L86 46.6493Z" className="fill-utility-gray-200" />
                    <path d="M86.001 46.6875V113.719L138 90.5625V24.75L86.001 46.6875Z" fill="url(#box-gradient-md)" />
                    <path d="M86 46.6875L138 24.75L86.4084 2L34 24.75L86 46.6875Z" className="fill-utility-gray-50" />
                    <path
                        d="M53.9062 16.1072L105.404 38.5221L105.874 54.9531L120.368 48.9727L119.93 32.438L66.7906 10.5205L53.9062 16.1072Z"
                        className="fill-utility-gray-200"
                    />
                </g>
                <defs>
                    <filter
                        id="box-shadow-md"
                        x="16.75"
                        y="0.908508"
                        width="138.5"
                        height="146.349"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.21875" operator="erode" in="SourceAlpha" result="box-shadow-md-effect1" />
                        <feOffset dy="2.4375" />
                        <feGaussianBlur stdDeviation="1.21875" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="box-shadow-md-effect1" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="3.25" operator="erode" in="SourceAlpha" result="box-shadow-md-effect2" />
                        <feOffset dy="6.5" />
                        <feGaussianBlur stdDeviation="3.25" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="box-shadow-md-effect1" result="box-shadow-md-effect2" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="3.25" operator="erode" in="SourceAlpha" result="box-shadow-md-effect3" />
                        <feOffset dy="16.25" />
                        <feGaussianBlur stdDeviation="9.75" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="box-shadow-md-effect2" result="box-shadow-md-effect3" />
                        <feBlend mode="normal" in="SourceGraphic" in2="box-shadow-md-effect3" result="shape" />
                    </filter>
                    <linearGradient id="box-gradient-md" x1="112" y1="24.75" x2="150.395" y2="92.3024" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-200" />
                    </linearGradient>
                </defs>
            </svg>

            {children && (
                <span
                    className={cx(
                        "absolute bottom-3 left-1/2 z-10 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-alpha-black/20 text-fg-white backdrop-blur-xs",
                        childrenClassName,
                    )}
                >
                    {children}
                </span>
            )}
        </div>
    );
};

export const lg = ({
    className,
    svgClassName,
    childrenClassName,
    children = <UploadCloud02 className="size-7" />,
    ...otherProps
}: Omit<IllustrationProps, "size">) => {
    return (
        <div {...otherProps} className={cx("relative h-45.25 w-55", className)}>
            <svg viewBox="0 0 220 181" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="110" cy="90" r="80" className="fill-utility-gray-100" />
                <circle cx="26" cy="30" r="8" className="fill-utility-gray-100" />
                <circle cx="198" cy="136" r="6" className="fill-utility-gray-100" />
                <circle cx="25" cy="148" r="10" className="fill-utility-gray-100" />
                <circle cx="210" cy="56" r="10" className="fill-utility-gray-100" />
                <circle cx="191" cy="21" r="7" className="fill-utility-gray-100" />
                <g filter="url(#box-shadow-lg)">
                    <path d="M110.001 139.432L174 111V30L110.503 2L46 30V111L110.001 139.432Z" className="fill-utility-gray-50" />
                    <path
                        d="M174.5 111.325L174.203 111.457L110.204 139.889L110.001 139.979L109.798 139.889L45.7969 111.457L45.5 111.325V29.6719L45.8008 29.541L110.304 1.54102L110.504 1.4541L110.704 1.54297L174.202 29.543L174.5 29.6738V111.325Z"
                        className="stroke-border-secondary_alt"
                    />
                    <path d="M110 56.9531V139.5L46 111V30.0001L110 56.9531Z" className="fill-utility-gray-200" />
                    <path d="M110.001 57V139.5L174 111V30L110.001 57Z" fill="url(#box-gradient-lg)" />
                    <path d="M110 57L174 30L110.503 2L46 30L110 57Z" className="fill-utility-gray-50" />
                    <path
                        d="M70.5 19.3627L133.882 46.9503L134.461 67.173L152.299 59.8125L151.759 39.4622L86.3577 12.4868L70.5 19.3627Z"
                        className="fill-utility-gray-200"
                    />
                </g>
                <defs>
                    <filter id="box-shadow-lg" x="25" y="0.908508" width="170" height="179.618" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="box-shadow-lg-effect1" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="box-shadow-lg-effect1" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="box-shadow-lg-effect2" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="box-shadow-lg-effect1" result="box-shadow-lg-effect2" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="box-shadow-lg-effect3" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="box-shadow-lg-effect2" result="box-shadow-lg-effect3" />
                        <feBlend mode="normal" in="SourceGraphic" in2="box-shadow-lg-effect3" result="shape" />
                    </filter>
                    <linearGradient id="box-gradient-lg" x1="142" y1="30" x2="189.255" y2="113.141" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-200" />
                    </linearGradient>
                </defs>
            </svg>

            {children && (
                <span
                    className={cx(
                        "absolute bottom-5 left-1/2 z-10 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-alpha-black/20 text-fg-white backdrop-blur-xs",
                        childrenClassName,
                    )}
                >
                    {children}
                </span>
            )}
        </div>
    );
};

const sizes = {
    sm,
    md,
    lg,
};
