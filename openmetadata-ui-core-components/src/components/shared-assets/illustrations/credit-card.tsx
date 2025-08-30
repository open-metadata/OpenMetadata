import type { HTMLAttributes } from "react";
import { AlertCircle } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface IllustrationProps extends HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "md" | "lg";
    svgClassName?: string;
    childrenClassName?: string;
}

export const CreditCardIllustration = ({ size = "lg", ...otherProps }: IllustrationProps) => {
    const Pattern = sizes[size];

    return <Pattern {...otherProps} />;
};

export const sm = ({
    className,
    svgClassName,
    childrenClassName,
    children = <AlertCircle className="size-6" />,
    ...otherProps
}: Omit<IllustrationProps, "size">) => {
    return (
        <div {...otherProps} className={cx("relative h-29.5 w-38", className)}>
            <svg viewBox="0 0 152 118" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="21" cy="5" r="5" className="fill-utility-gray-100" />
                <circle cx="18" cy="109" r="7" className="fill-utility-gray-100" />
                <circle cx="145" cy="35" r="7" className="fill-utility-gray-100" />
                <circle cx="134" cy="8" r="4" className="fill-utility-gray-100" />
                <circle cx="76" cy="52" r="52" className="fill-utility-gray-100" />
                <g filter="url(#credit-card-shadow-sm)">
                    <path
                        d="M18 18C18 14.6863 20.6863 12 24 12H127C130.314 12 133 14.6863 133 18V78C133 81.3137 130.314 84 127 84H24C20.6863 84 18 81.3137 18 78V18Z"
                        fill="url(#credit-card-gradient-sm)"
                    />
                    <path
                        d="M127 11.75C130.452 11.75 133.25 14.5482 133.25 18V78C133.25 81.4518 130.452 84.25 127 84.25H24C20.5482 84.25 17.75 81.4518 17.75 78V18C17.75 14.5482 20.5482 11.75 24 11.75H127Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path
                        d="M28 28C28 26.8954 28.8954 26 30 26H46C47.1046 26 48 26.8954 48 28V39C48 40.1046 47.1046 41 46 41H30C28.8954 41 28 40.1046 28 39V28Z"
                        className="fill-utility-gray-200"
                    />
                    <circle cx="114.667" cy="32.3335" r="8.33333" className="fill-utility-gray-300" />
                    <circle cx="104.667" cy="32.3333" r="8.33333" className="fill-utility-gray-200" />
                    <path
                        d="M28 73.6667C28 72.7462 28.7462 72 29.6667 72H46.3333C47.2538 72 48 72.7462 48 73.6667C48 74.5871 47.2538 75.3333 46.3333 75.3333H29.6667C28.7462 75.3333 28 74.5871 28 73.6667Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M53 73.6667C53 72.7462 53.7462 72 54.6667 72H71.3333C72.2538 72 73 72.7462 73 73.6667C73 74.5871 72.2538 75.3333 71.3333 75.3333H54.6667C53.7462 75.3333 53 74.5871 53 73.6667Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M78 73.6667C78 72.7462 78.7462 72 79.6667 72H96.3333C97.2538 72 98 72.7462 98 73.6667C98 74.5871 97.2538 75.3333 96.3333 75.3333H79.6667C78.7462 75.3333 78 74.5871 78 73.6667Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M103 73.6667C103 72.7462 103.746 72 104.667 72H121.333C122.254 72 123 72.7462 123 73.6667C123 74.5871 122.254 75.3333 121.333 75.3333H104.667C103.746 75.3333 103 74.5871 103 73.6667Z"
                        className="fill-utility-gray-300"
                    />
                </g>

                <defs>
                    <filter
                        id="credit-card-shadow-sm"
                        x="0.833333"
                        y="11.5"
                        width="149.333"
                        height="106.333"
                        filterUnits="userSpaceOnUse"
                        colorInterpolationFilters="sRGB"
                    >
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="3.33333" operator="erode" in="SourceAlpha" result="credit-card-shadow-sm-effect1" />
                        <feOffset dy="6.66667" />
                        <feGaussianBlur stdDeviation="3.33333" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0627451 0 0 0 0 0.0941176 0 0 0 0 0.156863 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="credit-card-shadow-sm-effect1" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="3.33333" operator="erode" in="SourceAlpha" result="credit-card-shadow-sm-effect2" />
                        <feOffset dy="16.6667" />
                        <feGaussianBlur stdDeviation="10" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0627451 0 0 0 0 0.0941176 0 0 0 0 0.156863 0 0 0 0.1 0" />
                        <feBlend mode="normal" in2="credit-card-shadow-sm-effect1" result="credit-card-shadow-sm-effect2" />
                        <feBlend mode="normal" in="SourceGraphic" in2="credit-card-shadow-sm-effect2" result="shape" />
                    </filter>
                    <linearGradient id="credit-card-gradient-sm" x1="22.0049" y1="83.1477" x2="19.9135" y2="17.2505" gradientUnits="userSpaceOnUse">
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
    children = <AlertCircle className="size-7" />,
    ...otherProps
}: Omit<IllustrationProps, "size">) => {
    return (
        <div {...otherProps} className={cx("relative h-35.75 w-45", className)}>
            <svg viewBox="0 0 180 143" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="90" cy="64" r="64" className="fill-utility-gray-100" />
                <circle cx="24" cy="6" r="6" className="fill-utility-gray-100" />
                <circle cx="21" cy="112" r="8" className="fill-utility-gray-100" />
                <circle cx="164" cy="36" r="8" className="fill-utility-gray-100" />
                <circle cx="153" cy="9" r="5" className="fill-utility-gray-100" />
                <g filter="url(#credit-card-shadow-md)">
                    <path
                        d="M21 22C21 18.6863 23.6863 16 27 16H153C156.314 16 159 18.6863 159 22V96C159 99.3137 156.314 102 153 102H27C23.6863 102 21 99.3137 21 96V22Z"
                        fill="url(#credit-card-gradient-md)"
                    />
                    <path
                        d="M153 15.75C156.452 15.75 159.25 18.5482 159.25 22V96C159.25 99.4518 156.452 102.25 153 102.25H27C23.5482 102.25 20.75 99.4518 20.75 96V22C20.75 18.5482 23.5482 15.75 27 15.75H153Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path
                        d="M33 38C33 36.8954 33.8954 36 35 36H55C56.1046 36 57 36.8954 57 38V52C57 53.1046 56.1046 54 55 54H35C33.8954 54 33 53.1046 33 52V38Z"
                        className="fill-utility-gray-200"
                    />
                    <circle cx="137" cy="42" r="10" className="fill-utility-gray-300" />
                    <circle cx="125" cy="42" r="10" className="fill-utility-gray-200" />
                    <path
                        d="M33 89C33 87.8954 33.8954 87 35 87H55C56.1046 87 57 87.8954 57 89C57 90.1046 56.1046 91 55 91H35C33.8954 91 33 90.1046 33 89Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M63 89C63 87.8954 63.8954 87 65 87H85C86.1046 87 87 87.8954 87 89C87 90.1046 86.1046 91 85 91H65C63.8954 91 63 90.1046 63 89Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M93 89C93 87.8954 93.8954 87 95 87H115C116.105 87 117 87.8954 117 89C117 90.1046 116.105 91 115 91H95C93.8954 91 93 90.1046 93 89Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M123 89C123 87.8954 123.895 87 125 87H145C146.105 87 147 87.8954 147 89C147 90.1046 146.105 91 145 91H125C123.895 91 123 90.1046 123 89Z"
                        className="fill-utility-gray-300"
                    />
                </g>

                <defs>
                    <filter id="credit-card-shadow-md" x="0.5" y="15.5" width="179" height="127" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="credit-card-shadow-md-effect1" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="credit-card-shadow-md-effect1" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="credit-card-shadow-md-effect2" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="credit-card-shadow-md-effect1" result="credit-card-shadow-md-effect2" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="credit-card-shadow-md-effect3" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="credit-card-shadow-md-effect2" result="credit-card-shadow-md-effect3" />
                        <feBlend mode="normal" in="SourceGraphic" in2="credit-card-shadow-md-effect3" result="shape" />
                    </filter>
                    <linearGradient id="credit-card-gradient-md" x1="25.8058" y1="100.982" x2="23.3193" y2="22.2707" gradientUnits="userSpaceOnUse">
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
    children = <AlertCircle className="size-7" />,
    ...otherProps
}: Omit<IllustrationProps, "size">) => {
    return (
        <div {...otherProps} className={cx("relative h-41.75 w-55", className)}>
            <svg viewBox="0 0 220 167" fill="none" className={cx("size-full stroke-inherit text-inherit", svgClassName)}>
                <circle cx="110" cy="80" r="80" className="fill-utility-gray-100" />
                <circle cx="18" cy="12" r="8" className="fill-utility-gray-100" />
                <circle cx="198" cy="142" r="6" className="fill-utility-gray-100" />
                <circle cx="25" cy="138" r="10" className="fill-utility-gray-100" />
                <circle cx="210" cy="46" r="10" className="fill-utility-gray-100" />
                <circle cx="191" cy="11" r="7" className="fill-utility-gray-100" />
                <g filter="url(#credit-card-shadow-lg)">
                    <path
                        d="M27 28C27 24.6863 29.6863 22 33 22H187C190.314 22 193 24.6863 193 28V120C193 123.314 190.314 126 187 126H33C29.6863 126 27 123.314 27 120V28Z"
                        fill="url(#credit-card-gradient-lg)"
                    />
                    <path
                        d="M187 21.75C190.452 21.75 193.25 24.5482 193.25 28V120C193.25 123.452 190.452 126.25 187 126.25H33C29.5482 126.25 26.75 123.452 26.75 120V28C26.75 24.5482 29.5482 21.75 33 21.75H187Z"
                        className="stroke-border-secondary_alt"
                        strokeWidth="0.5"
                    />
                    <path
                        d="M41.0698 48.186C41.0698 47.0815 41.9653 46.186 43.0698 46.186H68.0931C69.1977 46.186 70.0931 47.0815 70.0931 48.186V65.9535C70.0931 67.058 69.1977 67.9535 68.0931 67.9535H43.0698C41.9653 67.9535 41.0698 67.058 41.0698 65.9535V48.186Z"
                        className="fill-utility-gray-200"
                    />
                    <circle cx="166.837" cy="53.4419" r="12.093" className="fill-utility-gray-300" />
                    <circle cx="152.325" cy="53.4419" r="12.093" className="fill-utility-gray-200" />
                    <path
                        d="M41.0698 110.279C41.0698 108.943 42.1527 107.86 43.4884 107.86H67.6745C69.0102 107.86 70.0931 108.943 70.0931 110.279C70.0931 111.615 69.0102 112.698 67.6745 112.698H43.4884C42.1527 112.698 41.0698 111.615 41.0698 110.279Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M77.3489 110.279C77.3489 108.943 78.4317 107.86 79.7675 107.86H103.954C105.289 107.86 106.372 108.943 106.372 110.279C106.372 111.615 105.289 112.698 103.954 112.698H79.7675C78.4317 112.698 77.3489 111.615 77.3489 110.279Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M113.628 110.279C113.628 108.943 114.711 107.86 116.047 107.86H140.233C141.568 107.86 142.651 108.943 142.651 110.279C142.651 111.615 141.568 112.698 140.233 112.698H116.047C114.711 112.698 113.628 111.615 113.628 110.279Z"
                        className="fill-utility-gray-300"
                    />
                    <path
                        d="M149.907 110.279C149.907 108.943 150.99 107.86 152.326 107.86H176.512C177.847 107.86 178.93 108.943 178.93 110.279C178.93 111.615 177.847 112.698 176.512 112.698H152.326C150.99 112.698 149.907 111.615 149.907 110.279Z"
                        className="fill-utility-gray-300"
                    />
                </g>

                <defs>
                    <filter id="credit-card-shadow-lg" x="6.5" y="21.5" width="207" height="145" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="1.5" operator="erode" in="SourceAlpha" result="credit-card-shadow-lg-effect1" />
                        <feOffset dy="3" />
                        <feGaussianBlur stdDeviation="1.5" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.04 0" />
                        <feBlend mode="normal" in2="BackgroundImageFix" result="credit-card-shadow-lg-effect1" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="credit-card-shadow-lg-effect2" />
                        <feOffset dy="8" />
                        <feGaussianBlur stdDeviation="4" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.03 0" />
                        <feBlend mode="normal" in2="credit-card-shadow-lg-effect1" result="credit-card-shadow-lg-effect2" />
                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                        <feMorphology radius="4" operator="erode" in="SourceAlpha" result="credit-card-shadow-lg-effect3" />
                        <feOffset dy="20" />
                        <feGaussianBlur stdDeviation="12" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0496732 0 0 0 0 0.0705882 0 0 0 0.08 0" />
                        <feBlend mode="normal" in2="credit-card-shadow-lg-effect2" result="credit-card-shadow-lg-effect3" />
                        <feBlend mode="normal" in="SourceGraphic" in2="credit-card-shadow-lg-effect3" result="shape" />
                    </filter>
                    <linearGradient id="credit-card-gradient-lg" x1="32.7809" y1="124.769" x2="29.758" y2="29.5842" gradientUnits="userSpaceOnUse">
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
