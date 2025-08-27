import type { SVGProps } from "react";
import { useId } from "react";
import { cx } from "@/utils/cx";

export const UntitledLogoMinimal = (props: SVGProps<SVGSVGElement>) => {
    const id = useId();

    return (
        <svg viewBox="0 0 38 38" fill="none" {...props} className={cx("size-8 origin-center scale-[1.2]", props.className)}>
            <g filter={`url(#filter0-${id}`}>
                <g clipPath={`url(#clip0-${id}`}>
                    <path
                        d="M3 14.8C3 10.3196 3 8.07937 3.87195 6.36808C4.63893 4.86278 5.86278 3.63893 7.36808 2.87195C9.07937 2 11.3196 2 15.8 2H22.2C26.6804 2 28.9206 2 30.6319 2.87195C32.1372 3.63893 33.3611 4.86278 34.1281 6.36808C35 8.07937 35 10.3196 35 14.8V21.2C35 25.6804 35 27.9206 34.1281 29.6319C33.3611 31.1372 32.1372 32.3611 30.6319 33.1281C28.9206 34 26.6804 34 22.2 34H15.8C11.3196 34 9.07937 34 7.36808 33.1281C5.86278 32.3611 4.63893 31.1372 3.87195 29.6319C3 27.9206 3 25.6804 3 21.2V14.8Z"
                        fill="white"
                    />
                    <path
                        d="M3 14.8C3 10.3196 3 8.07937 3.87195 6.36808C4.63893 4.86278 5.86278 3.63893 7.36808 2.87195C9.07937 2 11.3196 2 15.8 2H22.2C26.6804 2 28.9206 2 30.6319 2.87195C32.1372 3.63893 33.3611 4.86278 34.1281 6.36808C35 8.07937 35 10.3196 35 14.8V21.2C35 25.6804 35 27.9206 34.1281 29.6319C33.3611 31.1372 32.1372 32.3611 30.6319 33.1281C28.9206 34 26.6804 34 22.2 34H15.8C11.3196 34 9.07937 34 7.36808 33.1281C5.86278 32.3611 4.63893 31.1372 3.87195 29.6319C3 27.9206 3 25.6804 3 21.2V14.8Z"
                        fill={`url(#paint0_linear-${id}`}
                        fillOpacity="0.2"
                    />
                    <g opacity="0.14" clipPath={`url(#clip1-${id}`}>
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M18.9612 2H19.0388V3.96123C20.8929 3.96625 22.6625 4.33069 24.2816 4.98855V2H24.3592V5.02038C25.7339 5.58859 26.9986 6.36882 28.1126 7.32031H29.602V2H29.6796V7.32031H35V7.39798H29.6796V8.88728C30.6311 10.0013 31.4113 11.266 31.9796 12.6406H35V12.7183H32.0114C32.6693 14.3373 33.0337 16.1069 33.0388 17.9609H35V18.0386H33.0388C33.0338 19.8927 32.6694 21.6622 32.0116 23.2812H35V23.3589H31.9798C31.4115 24.7337 30.6312 25.9986 29.6796 27.1128V28.6016H35V28.6792H29.6796V34H29.602V28.6792H28.1132C26.999 29.6309 25.7341 30.4113 24.3592 30.9797V34H24.2816V31.0115C22.6625 31.6693 20.8929 32.0338 19.0388 32.0388V34H18.9612V32.0388C17.1071 32.0338 15.3375 31.6693 13.7184 31.0115V34H13.6408V30.9797C12.2659 30.4113 11.001 29.6309 9.88678 28.6792H8.39804V34H8.32037V28.6792H3V28.6016H8.32037V27.1128C7.36877 25.9986 6.58847 24.7337 6.02023 23.3589H3V23.2812H5.9884C5.3306 21.6622 4.96621 19.8927 4.96122 18.0386H3V17.9609H4.96122C4.96627 16.1069 5.33073 14.3373 5.9886 12.7183H3V12.6406H6.02044C6.58866 11.266 7.36889 10.0013 8.32037 8.88728V7.39798H3V7.32031H8.32037V2H8.39804V7.32031H9.88736C11.0014 6.36882 12.2661 5.58859 13.6408 5.02038V2H13.7184V4.98855C15.3375 4.33069 17.1071 3.96626 18.9612 3.96123V2ZM18.9612 4.0389C17.1062 4.04396 15.3364 4.41075 13.7184 5.07245V7.32031H18.9612V4.0389ZM13.6408 5.10449C12.3137 5.65662 11.0902 6.40763 10.0074 7.32031H13.6408V5.10449ZM9.79719 7.39798H8.39804V8.79711C8.8311 8.29865 9.29872 7.83103 9.79719 7.39798ZM8.39804 8.91598C8.86452 8.37206 9.37213 7.86446 9.91606 7.39798H13.6408V12.6406H8.39804V8.91598ZM8.32037 9.00733C7.4077 10.0901 6.65669 11.3136 6.10454 12.6406H8.32037V9.00733ZM6.0725 12.7183C5.41078 14.3362 5.04397 16.106 5.03889 17.9609H8.32037V12.7183H6.0725ZM5.03889 18.0386C5.04391 19.8935 5.41065 21.6633 6.0723 23.2812H8.32037V18.0386H5.03889ZM6.10434 23.3589C6.6565 24.6861 7.40759 25.9098 8.32037 26.9927V23.3589H6.10434ZM8.39804 27.2029V28.6016H9.79662C9.29837 28.1686 8.83093 27.7012 8.39804 27.2029ZM9.91548 28.6016C9.37178 28.1352 8.86436 27.6278 8.39804 27.0841V23.3589H13.6408V28.6016H9.91548ZM10.0068 28.6792C11.0898 29.5921 12.3135 30.3433 13.6408 30.8955V28.6792H10.0068ZM13.7184 30.9276C15.3364 31.5893 17.1062 31.9561 18.9612 31.9611V28.6792H13.7184V30.9276ZM19.0388 31.9611C20.8937 31.9561 22.6636 31.5893 24.2816 30.9276V28.6792H19.0388V31.9611ZM24.3592 30.8955C25.6865 30.3433 26.9102 29.5921 27.9932 28.6792H24.3592V30.8955ZM28.2034 28.6016H29.602V27.2029C29.1691 27.7012 28.7016 28.1686 28.2034 28.6016ZM29.602 27.0841C29.1356 27.6278 28.6282 28.1352 28.0845 28.6016H24.3592V23.3589H29.602V27.0841ZM29.6796 26.9927C30.5924 25.9098 31.3435 24.6861 31.8957 23.3589H29.6796V26.9927ZM31.9277 23.2812C32.5894 21.6633 32.9561 19.8935 32.9611 18.0386H29.6796V23.2812H31.9277ZM32.9611 17.9609C32.956 16.1061 32.5892 14.3362 31.9275 12.7183H29.6796V17.9609H32.9611ZM31.8955 12.6406C31.3433 11.3136 30.5923 10.0901 29.6796 9.00733V12.6406H31.8955ZM29.602 8.79711V7.39798H28.2028C28.7013 7.83103 29.1689 8.29865 29.602 8.79711ZM28.0839 7.39798C28.6279 7.86446 29.1355 8.37206 29.602 8.91598V12.6406H24.3592V7.39798H28.0839ZM27.9926 7.32031C26.9098 6.40763 25.6863 5.65662 24.3592 5.10449V7.32031H27.9926ZM24.2816 5.07245C22.6636 4.41074 20.8937 4.04395 19.0388 4.0389V7.32031H24.2816V5.07245ZM13.7184 7.39798H18.9612V12.6406H13.7184V7.39798ZM24.2816 7.39798H19.0388V12.6406H24.2816V7.39798ZM13.6408 23.2812H8.39804V18.0386H13.6408V23.2812ZM13.7184 23.3589V28.6016H18.9612V23.3589H13.7184ZM18.9612 23.2812H13.7184V18.0386H18.9612V23.2812ZM19.0388 23.3589V28.6016H24.2816V23.3589H19.0388ZM24.2816 23.2812H19.0388V18.0386H24.2816V23.2812ZM29.602 23.2812H24.3592V18.0386H29.602V23.2812ZM13.7184 12.7183H18.9612V17.9609H13.7184V12.7183ZM8.39804 12.7183L13.6408 12.7183V17.9609H8.39804V12.7183ZM24.2816 12.7183H19.0388V17.9609H24.2816V12.7183ZM24.3592 17.9609V12.7183L29.602 12.7183V17.9609H24.3592Z"
                            fill="#0A0D12"
                        />
                    </g>
                    <g filter={`url(#filter1_dd-${id}`}>
                        <rect x="11" y="10" width="16" height="16" rx="8" fill={`url(#paint1_linear-${id}`} />
                        <rect x="11" y="10" width="16" height="16" rx="8" fill={`url(#paint2_radial-${id}`} fillOpacity="0.08" />
                        <rect x="11" y="10" width="16" height="16" rx="8" fill={`url(#paint3_radial-${id}`} fillOpacity="0.18" />
                        <rect x="11" y="10" width="16" height="16" rx="8" fill={`url(#paint4_radial-${id}`} fillOpacity="0.05" />
                        <path
                            d="M23.8 14.0414C23.8 15.3898 21.651 14.5297 19 14.5297C16.349 14.5297 14.2 15.3898 14.2 14.0414C14.2 12.693 16.349 11.6 19 11.6C21.651 11.6 23.8 12.693 23.8 14.0414Z"
                            fill={`url(#paint5_linear-${id}`}
                            fillOpacity="0.4"
                        />
                    </g>
                </g>
                <path
                    d="M3.1 14.8C3.1 12.5581 3.10008 10.8828 3.20866 9.55376C3.31715 8.22593 3.53345 7.25268 3.96105 6.41348C4.71845 4.92699 5.92699 3.71845 7.41348 2.96105C8.25268 2.53345 9.22593 2.31715 10.5538 2.20866C11.8828 2.10008 13.5581 2.1 15.8 2.1H22.2C24.4419 2.1 26.1172 2.10008 27.4462 2.20866C28.7741 2.31715 29.7473 2.53345 30.5865 2.96105C32.073 3.71845 33.2816 4.92699 34.039 6.41348C34.4665 7.25268 34.6828 8.22593 34.7913 9.55376C34.8999 10.8828 34.9 12.5581 34.9 14.8V21.2C34.9 23.4419 34.8999 25.1172 34.7913 26.4462C34.6828 27.7741 34.4665 28.7473 34.039 29.5865C33.2816 31.073 32.073 32.2816 30.5865 33.039C29.7473 33.4665 28.7741 33.6828 27.4462 33.7913C26.1172 33.8999 24.4419 33.9 22.2 33.9H15.8C13.5581 33.9 11.8828 33.8999 10.5538 33.7913C9.22593 33.6828 8.25268 33.4665 7.41348 33.039C5.92699 32.2816 4.71845 31.073 3.96105 29.5865C3.53345 28.7473 3.31715 27.7741 3.20866 26.4462C3.10008 25.1172 3.1 23.4419 3.1 21.2V14.8Z"
                    stroke="#0A0D12"
                    strokeOpacity="0.12"
                    strokeWidth="0.2"
                />
            </g>
            <image
                href="data:image/webp;base64,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"
                x="0"
                y="19"
                width="38"
                height="19"
                transform="scale(0.84) translate(0, -1.5)"
                className="origin-center"
                preserveAspectRatio="xMidYMax slice"
                clipPath={`url(#imageClip-${id})`}
            />

            <defs>
                <clipPath id={`imageClip-${id}`}>
                    <path d="M 0 19 L 38 19 L 38 28.88  A 9.12 9.12 0 0 1 28.88 38 L 9.12 38 A 9.12 9.12 0 0 1 0 28.88 Z" />
                </clipPath>
                <filter id={`filter0-${id}`} x="0" y="0" width="38" height="38" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.06 0" />
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="1.5" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.1 0" />
                    <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feMorphology radius="0.5" operator="erode" in="SourceAlpha" result="effect3_dropShadow" />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="0.5" />
                    <feComposite in2="hardAlpha" operator="out" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.13 0" />
                    <feBlend mode="normal" in2="effect2_dropShadow" result="effect3_dropShadow" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect3_dropShadow" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="-0.5" />
                    <feGaussianBlur stdDeviation="0.25" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.1 0" />
                    <feBlend mode="normal" in2="shape" result="effect4_innerShadow" />
                </filter>
                <filter id={`filter1_dd-${id}`} x="8" y="8" width="22" height="22" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.06 0" />
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="1.5" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0509804 0 0 0 0 0.0705882 0 0 0 0.1 0" />
                    <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow" result="shape" />
                </filter>
                <filter id={`filter2_b-${id}`} x="-2" y="13" width="42" height="26" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feGaussianBlur in="BackgroundImageFix" stdDeviation="2.5" />
                    <feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_backgroundBlur" result="shape" />
                </filter>
                <linearGradient id={`paint0_linear-${id}`} x1="19" y1="2" x2="19" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="#0A0D12" />
                </linearGradient>
                <linearGradient id={`paint1_linear-${id}`} x1="15" y1="26" x2="23" y2="10" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#53389E" />
                    <stop offset="1" stopColor="#6941C6" />
                </linearGradient>
                <radialGradient
                    id={`paint2_radial-${id}`}
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(19 10) rotate(90) scale(12)"
                >
                    <stop stopColor="white" stopOpacity="0" />
                    <stop offset="0.5" stopColor="white" stopOpacity="0" />
                    <stop offset="0.99" stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                    id={`paint3_radial-${id}`}
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(19 18) rotate(90) scale(8)"
                >
                    <stop offset="0.746599" stopColor="white" stopOpacity="0" />
                    <stop offset="1" stopColor="white" />
                </radialGradient>
                <radialGradient
                    id={`paint4_radial-${id}`}
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(19 14.6) rotate(90) scale(7)"
                >
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`paint5_linear-${id}`} x1="19" y1="11.6" x2="19" y2="14.8" gradientUnits="userSpaceOnUse">
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0.1" />
                </linearGradient>
                <clipPath id={`clip0-${id}`}>
                    <path
                        d="M3 14.8C3 10.3196 3 8.07937 3.87195 6.36808C4.63893 4.86278 5.86278 3.63893 7.36808 2.87195C9.07937 2 11.3196 2 15.8 2H22.2C26.6804 2 28.9206 2 30.6319 2.87195C32.1372 3.63893 33.3611 4.86278 34.1281 6.36808C35 8.07937 35 10.3196 35 14.8V21.2C35 25.6804 35 27.9206 34.1281 29.6319C33.3611 31.1372 32.1372 32.3611 30.6319 33.1281C28.9206 34 26.6804 34 22.2 34H15.8C11.3196 34 9.07937 34 7.36808 33.1281C5.86278 32.3611 4.63893 31.1372 3.87195 29.6319C3 27.9206 3 25.6804 3 21.2V14.8Z"
                        fill="white"
                    />
                </clipPath>
                <clipPath id={`clip1-${id}`}>
                    <rect width="32" height="32" fill="white" transform="translate(3 2)" />
                </clipPath>
            </defs>
        </svg>
    );
};
