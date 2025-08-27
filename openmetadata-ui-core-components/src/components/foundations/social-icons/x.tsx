import type { SVGProps } from "react";

interface Props extends SVGProps<SVGSVGElement> {
    size?: number;
}

const X = ({ size = 24, ...props }: Props) => {
    return (
        <svg width={size} height={size} viewBox="0 0 24 22" fill="none" {...props}>
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.9455 22L10.396 14.0901L3.44886 22H0.509766L9.09209 12.2311L0.509766 0H8.05571L13.286 7.45502L19.8393 0H22.7784L14.5943 9.31648L23.4914 22H15.9455ZM19.2185 19.77H17.2398L4.71811 2.23H6.6971L11.7121 9.25316L12.5793 10.4719L19.2185 19.77Z"
                fill="currentColor"
            />
        </svg>
    );
};

export default X;
