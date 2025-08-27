import type { HTMLAttributes } from "react";
import { UploadCloud02 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface IllustrationProps extends HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "md" | "lg";
    svgClassName?: string;
    childrenClassName?: string;
}

export const DocumentsIllustration = ({ size = "lg", ...otherProps }: IllustrationProps) => {
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
        <div {...otherProps} className={cx("relative h-30 w-40.25", className)}>
            <svg viewBox="0 0 161 120" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="27" cy="11" r="5" className="fill-utility-gray-100" />
                <circle cx="24" cy="109" r="7" className="fill-utility-gray-100" />
                <circle cx="151" cy="35" r="7" className="fill-utility-gray-100" />
                <circle cx="140" cy="8" r="4" className="fill-utility-gray-100" />
                <circle cx="82" cy="52" r="52" className="fill-utility-gray-100" />
                <g filter="url(#documents-shadow-01-sm)">
                    <path
                        d="M47.7267 79.1102L80.9652 63.6108C82.634 62.8326 83.356 60.8489 82.5778 59.1801L62.9485 17.0849L49.6564 12.2469L22.4612 24.9282C20.7924 25.7064 20.0704 27.6901 20.8486 29.359L43.296 77.4975C44.0741 79.1663 46.0578 79.8883 47.7267 79.1102Z"
                        fill="url(#documents-gradient-01-sm)"
                    />
                    <path
                        d="M82.8045 59.0745C83.6409 60.8685 82.8648 63.0009 81.071 63.8374L47.8323 79.3368C46.0384 80.1733 43.906 79.3971 43.0694 77.6033L20.622 29.4646L20.5484 29.2952C19.8352 27.5384 20.6177 25.5121 22.3555 24.7017L49.6448 11.9765L63.1313 16.8852L82.8045 59.0745Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M49.6569 12.2471L62.949 17.085L53.884 21.3121L49.6569 12.2471Z" className="fill-utility-gray-200" />
                </g>
                <g filter="url(#documents-shadow-02-sm)">
                    <path
                        d="M63.6162 67.7831H100.291C102.132 67.7831 103.625 66.2904 103.625 64.4491V18.0022L93.6227 8H63.6162C61.7748 8 60.2821 9.49271 60.2821 11.3341V64.4491C60.2821 66.2904 61.7748 67.7831 63.6162 67.7831Z"
                        fill="url(#documents-gradient-02-sm)"
                    />
                    <path
                        d="M103.875 64.4492C103.875 66.4285 102.27 68.0332 100.291 68.0332H63.6161C61.6368 68.0332 60.0322 66.4285 60.0321 64.4492V11.334L60.037 11.1494C60.1331 9.25583 61.6986 7.75004 63.6161 7.75H93.7264L103.875 17.8984V64.4492Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M93.6226 8L103.625 18.0022H93.6226V8Z" className="fill-utility-gray-200" />
                </g>
                <g filter="url(#documents-shadow-03-sm)">
                    <path
                        d="M82.4745 63.5909L115.713 79.0903C117.382 79.8685 119.366 79.1465 120.144 77.4777L139.773 35.3825L134.935 22.0903L107.74 9.40903C106.071 8.63085 104.087 9.35286 103.309 11.0217L80.8619 59.1602C80.0837 60.8291 80.8057 62.8128 82.4745 63.5909Z"
                        fill="url(#documents-gradient-03-sm)"
                    />
                    <path
                        d="M120.37 77.5835C119.534 79.3773 117.401 80.1535 115.607 79.317L82.3688 63.8176C80.5749 62.981 79.7988 60.8486 80.6352 59.0547L103.083 10.916L103.165 10.7507C104.053 9.0752 106.108 8.37211 107.846 9.18243L135.135 21.9076L140.044 35.3941L120.37 77.5835Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M134.936 22.0903L139.774 35.3825L130.708 31.1554L134.936 22.0903Z" className="fill-utility-gray-200" />
                </g>

                <defs>
                    <filter
                        id="documents-shadow-01-sm"
                        x="-0.560448"
                        y="8.0199"
                        width="104.547"
                        height="112.499"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_1949" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_1949" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_1949" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_1949" result="effect2_dropShadow_1182_1949" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_1949" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_1949" result="effect3_dropShadow_1182_1949" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_1949" result="shape" />
                    </filter>
                    <filter
                        id="documents-shadow-02-sm"
                        x="39.7821"
                        y="7.5"
                        width="84.3428"
                        height="100.783"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_1949" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_1949" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_1949" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_1949" result="effect2_dropShadow_1182_1949" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_1949" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_1949" result="effect3_dropShadow_1182_1949" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_1949" result="shape" />
                    </filter>
                    <filter
                        id="documents-shadow-03-sm"
                        x="59.4529"
                        y="8"
                        width="104.547"
                        height="112.499"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_1949" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_1949" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_1949" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_1949" result="effect2_dropShadow_1182_1949" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_1949" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_1949" result="effect3_dropShadow_1182_1949" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_1949" result="shape" />
                    </filter>
                    <linearGradient id="documents-gradient-01-sm" x1="45.7739" y1="79.2399" x2="19.2854" y2="31.4527" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
                    </linearGradient>
                    <linearGradient id="documents-gradient-02-sm" x1="61.7915" y1="67.0755" x2="57.9806" y2="12.571" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
                    </linearGradient>
                    <linearGradient id="documents-gradient-03-sm" x1="81.1199" y1="62.1785" x2="100.701" y2="11.17" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
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
        <div {...otherProps} className={cx("relative h-34.25 w-46.25", className)}>
            <svg viewBox="0 0 185 137" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="95" cy="64" r="64" className="fill-utility-gray-100" />
                <circle cx="29" cy="12" r="6" className="fill-utility-gray-100" />
                <circle cx="26" cy="112" r="8" className="fill-utility-gray-100" />
                <circle cx="173" cy="96" r="8" className="fill-utility-gray-100" />
                <circle cx="158" cy="9" r="5" className="fill-utility-gray-100" />
                <g filter="url(#documents-shadow-01-md)">
                    <path
                        d="M53.9372 95.3137L93.8147 76.7185C95.8169 75.7848 96.6831 73.4049 95.7495 71.4028L72.1994 20.8995L56.2523 15.0953L23.6252 30.3095C21.6231 31.2431 20.7569 33.6231 21.6905 35.6252L48.6215 93.3789C49.5551 95.3811 51.935 96.2473 53.9372 95.3137Z"
                        fill="url(#documents-gradient-01-md)"
                    />
                    <path
                        d="M95.9762 71.2975C96.9679 73.4247 96.0477 75.9536 93.9206 76.9455L54.043 95.5407C51.9159 96.5326 49.3872 95.612 48.3951 93.485L21.4639 35.7309C20.4719 33.6036 21.3923 31.0749 23.5196 30.0829L56.2405 14.8249L72.3823 20.7001L95.9762 71.2975Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M56.2523 15.0952L72.1994 20.8995L61.3237 25.9709L56.2523 15.0952Z" className="fill-utility-gray-200" />
                </g>
                <g filter="url(#documents-shadow-02-md)">
                    <path
                        d="M73 81.7241H117C119.209 81.7241 121 79.9333 121 77.7241V22L109 10H73C70.7909 10 69 11.7909 69 14V77.7241C69 79.9333 70.7909 81.7241 73 81.7241Z"
                        fill="url(#documents-gradient-02-md)"
                    />
                    <path
                        d="M121.25 77.7246C121.25 80.0716 119.347 81.9746 117 81.9746H73C70.6529 81.9746 68.7503 80.0716 68.75 77.7246V14C68.75 11.6528 70.6528 9.75 73 9.75H109.104L121.25 21.8965V77.7246Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M109 10L121 22H109V10Z" className="fill-utility-gray-200" />
                </g>
                <g filter="url(#documents-shadow-03-md)">
                    <path
                        d="M95.6253 76.6946L135.503 95.2898C137.505 96.2234 139.885 95.3572 140.819 93.3551L164.369 42.8518L158.564 26.9047L125.937 11.6905C123.935 10.7569 121.555 11.6231 120.622 13.6252L93.6906 71.3789C92.7569 73.3811 93.6232 75.761 95.6253 76.6946Z"
                        fill="url(#documents-gradient-03-md)"
                    />
                    <path
                        d="M141.045 93.4611C140.053 95.5881 137.524 96.5087 135.397 95.5168L95.5195 76.9216C93.3923 75.9297 92.4721 73.4009 93.4638 71.2737L120.395 13.5196C121.387 11.3923 123.916 10.4719 126.043 11.4639L158.764 26.7219L164.639 42.8637L141.045 93.4611Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M158.564 26.9048L164.369 42.8519L153.493 37.7805L158.564 26.9048Z" className="fill-utility-gray-200" />
                </g>

                <defs>
                    <filter
                        id="documents-shadow-01-md"
                        x="0"
                        y="10.0238"
                        width="117.44"
                        height="126.98"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_2009" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_2009" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_2009" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_2009" result="effect2_dropShadow_1182_2009" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_2009" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_2009" result="effect3_dropShadow_1182_2009" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_2009" result="shape" />
                    </filter>
                    <filter
                        id="documents-shadow-02-md"
                        x="48.5"
                        y="9.5"
                        width="93"
                        height="112.724"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_2009" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_2009" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_2009" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_2009" result="effect2_dropShadow_1182_2009" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_2009" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_2009" result="effect3_dropShadow_1182_2009" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_2009" result="shape" />
                    </filter>
                    <filter
                        id="documents-shadow-03-md"
                        x="72.0001"
                        y="10"
                        width="117.44"
                        height="126.98"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_2009" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_2009" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_2009" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_2009" result="effect2_dropShadow_1182_2009" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_2009" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_2009" result="effect3_dropShadow_1182_2009" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_2009" result="shape" />
                    </filter>
                    <linearGradient id="documents-gradient-01-md" x1="51.5944" y1="95.4694" x2="19.8151" y2="38.1371" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
                    </linearGradient>
                    <linearGradient id="documents-gradient-02-md" x1="70.8109" y1="80.8751" x2="66.2388" y2="15.484" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
                    </linearGradient>
                    <linearGradient id="documents-gradient-03-md" x1="94.0001" y1="75" x2="117.492" y2="13.8032" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
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
        <div {...otherProps} className={cx("relative h-41.5 w-57.5", className)}>
            <svg viewBox="0 0 230 166" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="118" cy="80" r="80" className="fill-utility-gray-100" />
                <circle cx="34" cy="20" r="8" className="fill-utility-gray-100" />
                <circle cx="206" cy="126" r="6" className="fill-utility-gray-100" />
                <circle cx="33" cy="138" r="10" className="fill-utility-gray-100" />
                <circle cx="218" cy="38" r="10" className="fill-utility-gray-100" />
                <circle cx="199" cy="11" r="7" className="fill-utility-gray-100" />
                <g filter="url(#documents-shadow-01-lg)">
                    <path
                        d="M64.0781 124.214L116.529 99.7552C119.163 98.5272 120.302 95.3969 119.074 92.7634L88.0986 26.3361L67.1232 18.7017L24.2085 38.7132C21.5751 39.9412 20.4357 43.0715 21.6637 45.7049L57.0863 121.669C58.3143 124.302 61.4446 125.442 64.0781 124.214Z"
                        fill="url(#documents-gradient-01-lg)"
                    />
                    <path
                        d="M119.301 92.6576C120.587 95.4162 119.394 98.6959 116.635 99.9823L64.1844 124.44C61.4258 125.727 58.1461 124.533 56.8597 121.775L21.4374 45.811C20.151 43.0524 21.3447 39.7727 24.1033 38.4864L67.1114 18.4314L67.2087 18.4668L88.1843 26.1006L88.2816 26.136L119.301 92.6576Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M67.123 18.7017L88.0984 26.3361L73.7935 33.0066L67.123 18.7017Z" className="fill-utility-gray-200" />
                </g>
                <g filter="url(#documents-shadow-02-lg)">
                    <path
                        d="M89.1516 106.339H147.025C149.931 106.339 152.286 103.984 152.286 101.078V27.7837L136.503 12H89.1516C86.2459 12 83.8904 14.3555 83.8904 17.2612V101.078C83.8904 103.984 86.2459 106.339 89.1516 106.339Z"
                        fill="url(#documents-gradient-02-lg)"
                    />
                    <path
                        d="M152.537 101.078C152.537 104.122 150.069 106.59 147.025 106.59H89.1521C86.1083 106.59 83.6404 104.122 83.6404 101.078V17.2617C83.6404 14.2179 86.1083 11.75 89.1521 11.75H136.606L136.679 11.8232L152.464 27.6064L152.537 27.6797V101.078Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M136.503 12L152.286 27.7837H136.503V12Z" className="fill-utility-gray-200" />
                </g>
                <g filter="url(#documents-shadow-03-lg)">
                    <path
                        d="M118.911 99.724L171.362 124.182C173.996 125.41 177.126 124.271 178.354 121.638L209.329 55.2103L201.695 34.2349L158.78 14.2235C156.147 12.9955 153.017 14.1348 151.789 16.7683L116.366 92.7322C115.138 95.3657 116.277 98.496 118.911 99.724Z"
                        fill="url(#documents-gradient-03-lg)"
                    />
                    <path
                        d="M178.581 121.743C177.295 124.502 174.015 125.696 171.256 124.409L118.805 99.9512C116.047 98.6649 114.853 95.3851 116.139 92.6265L151.562 16.6631C152.848 13.9045 156.128 12.7108 158.886 13.9971L201.894 34.0521L201.93 34.1494L209.565 55.1245L209.6 55.2219L178.581 121.743Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path d="M201.695 34.2349L209.329 55.2102L195.024 48.5398L201.695 34.2349Z" className="fill-utility-gray-200" />
                </g>

                <defs>
                    <filter
                        id="documents-shadow-01-lg"
                        x="-0.559753"
                        y="12.0312"
                        width="141.857"
                        height="154.406"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_2741" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_2741" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_2741" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_2741" result="effect2_dropShadow_1182_2741" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_2741" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_2741" result="effect3_dropShadow_1182_2741" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_2741" result="shape" />
                    </filter>
                    <filter
                        id="documents-shadow-02-lg"
                        x="63.3904"
                        y="11.5"
                        width="109.396"
                        height="135.339"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_2741" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_2741" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_2741" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_2741" result="effect2_dropShadow_1182_2741" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_2741" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_2741" result="effect3_dropShadow_1182_2741" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_2741" result="shape" />
                    </filter>
                    <filter
                        id="documents-shadow-03-lg"
                        x="94.1425"
                        y="12"
                        width="141.857"
                        height="154.406"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="effect1_dropShadow_1182_2741" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1182_2741" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect2_dropShadow_1182_2741" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="effect1_dropShadow_1182_2741" result="effect2_dropShadow_1182_2741" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect3_dropShadow_1182_2741" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="effect2_dropShadow_1182_2741" result="effect3_dropShadow_1182_2741" />
                        <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow_1182_2741" result="shape" />
                    </filter>
                    <linearGradient id="documents-gradient-01-lg" x1="60.9966" y1="124.418" x2="19.197" y2="49.0089" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
                    </linearGradient>
                    <linearGradient id="documents-gradient-02-lg" x1="86.2723" y1="105.223" x2="80.2585" y2="19.2131" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
                    </linearGradient>
                    <linearGradient id="documents-gradient-03-lg" x1="116.773" y1="97.4951" x2="147.672" y2="17.0024" gradientUnits="userSpaceOnUse">
                        <stop stopColor="currentColor" className="text-utility-gray-100" />
                        <stop offset="1" stopColor="currentColor" className="text-utility-gray-50" />
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
