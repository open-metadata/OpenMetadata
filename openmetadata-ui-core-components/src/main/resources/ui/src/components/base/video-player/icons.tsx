import type { SVGProps } from "react";

export const PlayIcon = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
            <path
                d="M2.19995 2.86327C2.19995 1.61155 3.57248 0.844595 4.63851 1.50061L12.9856 6.63731C14.0009 7.26209 14.0009 8.73784 12.9856 9.36262L4.63851 14.4993C3.57247 15.1553 2.19995 14.3884 2.19995 13.1367V2.86327Z"
                fill="currentColor"
            />
        </svg>
    );
};

export const PauseIcon = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
            <path
                d="M2.19995 2.5C2.19995 2.22386 2.42381 2 2.69995 2H5.19995C5.47609 2 5.69995 2.22386 5.69995 2.5V13.5C5.69995 13.7761 5.47609 14 5.19995 14H2.69995C2.42381 14 2.19995 13.7761 2.19995 13.5V2.5Z"
                fill="currentColor"
            />
            <path
                d="M10.2 2.5C10.2 2.22386 10.4238 2 10.7 2H13.2C13.4761 2 13.7 2.22386 13.7 2.5V13.5C13.7 13.7761 13.4761 14 13.2 14H10.7C10.4238 14 10.2 13.7761 10.2 13.5V2.5Z"
                fill="currentColor"
            />
        </svg>
    );
};
