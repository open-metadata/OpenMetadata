import { cx as clx, sortCx } from "@/utils/cx";

interface ProgressBarProps {
    value: number;
    min?: number;
    max?: number;
    size: "xxs" | "xs" | "sm" | "md" | "lg";
    label?: string;
    valueFormatter?: (value: number, valueInPercentage: number) => string | number;
}

const sizes = sortCx({
    xxs: {
        strokeWidth: 6,
        radius: 29,
        valueClass: "tw:text-sm tw:font-semibold tw:text-primary",
        labelClass: "tw:text-xs tw:font-medium tw:text-tertiary",
        halfCircleTextPosition: "tw:absolute tw:bottom-0.5 tw:text-center",
    },
    xs: {
        strokeWidth: 16,
        radius: 72,
        valueClass: "tw:text-display-xs tw:font-semibold tw:text-primary",
        labelClass: "tw:text-xs tw:font-medium tw:text-tertiary",
        halfCircleTextPosition: "tw:absolute tw:bottom-0.5 tw:text-center",
    },
    sm: {
        strokeWidth: 20,
        radius: 90,
        valueClass: "tw:text-display-sm tw:font-semibold tw:text-primary",
        labelClass: "tw:text-xs tw:font-medium tw:text-tertiary",
        halfCircleTextPosition: "tw:absolute tw:bottom-1 tw:text-center",
    },
    md: {
        strokeWidth: 24,
        radius: 108,
        valueClass: "tw:text-display-md tw:font-semibold tw:text-primary",
        labelClass: "tw:text-sm tw:font-medium tw:text-tertiary",
        halfCircleTextPosition: "tw:absolute tw:bottom-1 tw:text-center",
    },
    lg: {
        strokeWidth: 28,
        radius: 126,
        valueClass: "tw:text-display-lg tw:font-semibold tw:text-primary",
        labelClass: "tw:text-sm tw:font-medium tw:text-tertiary",
        halfCircleTextPosition: "tw:absolute tw:bottom-0 tw:text-center",
    },
});

export const ProgressBarCircle = ({ value, min = 0, max = 100, size, label, valueFormatter }: ProgressBarProps) => {
    const percentage = Math.round(((value - min) * 100) / (max - min));

    const sizeConfig = sizes[size];

    const { strokeWidth, radius, valueClass, labelClass } = sizeConfig;

    const diameter = 2 * (radius + strokeWidth / 2);
    const width = diameter;
    const height = diameter;
    const viewBox = `0 0 ${width} ${height}`;
    const cx = diameter / 2;
    const cy = diameter / 2;

    const textPosition = label ? "absolute text-center" : "absolute text-primary";
    const strokeDashoffset = 100 - percentage;

    return (
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-0.5">
            <div role="progressbar" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} className="tw:relative tw:flex tw:w-max tw:items-center tw:justify-center">
                <svg className="tw:-rotate-90" width={width} height={height} viewBox={viewBox}>
                    {/* Background circle */}
                    <circle
                        className="tw:stroke-bg-quaternary"
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        pathLength="100"
                        strokeDasharray="100"
                        strokeLinecap="round"
                    />

                    {/* Foreground circle */}
                    <circle
                        className="tw:stroke-fg-brand-primary"
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        pathLength="100"
                        strokeDasharray="100"
                        strokeLinecap="round"
                        strokeDashoffset={strokeDashoffset}
                    />
                </svg>
                {label && size !== "xxs" ? (
                    <div className="tw:absolute tw:text-center">
                        <div className={labelClass}>{label}</div>
                        <div className={valueClass}>{valueFormatter ? valueFormatter(value, percentage) : `${percentage}%`}</div>
                    </div>
                ) : (
                    <span className={clx(textPosition, valueClass)}>{valueFormatter ? valueFormatter(value, percentage) : `${percentage}%`}</span>
                )}
            </div>

            {label && size === "xxs" && <div className={labelClass}>{label}</div>}
        </div>
    );
};

export const ProgressBarHalfCircle = ({ value, min = 0, max = 100, size, label, valueFormatter }: ProgressBarProps) => {
    const percentage = Math.round(((value - min) * 100) / (max - min));

    const sizeConfig = sizes[size];

    const { strokeWidth, radius, valueClass, labelClass, halfCircleTextPosition } = sizeConfig;

    const width = 2 * (radius + strokeWidth / 2);
    const height = radius + strokeWidth;
    const viewBox = `0 0 ${width} ${height}`;
    const cx = "50%";
    const cy = radius + strokeWidth / 2;

    const strokeDashoffset = -50 - (100 - percentage) / 2;

    return (
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-0.5">
            <div role="progressbar" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} className="tw:relative tw:flex tw:w-max tw:items-center tw:justify-center">
                <svg width={width} height={height} viewBox={viewBox}>
                    {/* Background half-circle */}
                    <circle
                        className="tw:stroke-bg-quaternary"
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        pathLength="100"
                        strokeDasharray="100"
                        strokeDashoffset="-50"
                        strokeLinecap="round"
                    />

                    {/* Foreground half-circle */}
                    <circle
                        className="tw:origin-center tw:-scale-x-100 tw:stroke-fg-brand-primary"
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        pathLength="100"
                        strokeDasharray="100"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>

                {label && size !== "xxs" ? (
                    <div className={halfCircleTextPosition}>
                        <div className={labelClass}>{label}</div>
                        <div className={valueClass}>{valueFormatter ? valueFormatter(value, percentage) : `${percentage}%`}</div>
                    </div>
                ) : (
                    <span className={clx(halfCircleTextPosition, valueClass)}>{valueFormatter ? valueFormatter(value, percentage) : `${percentage}%`}</span>
                )}
            </div>

            {label && size === "xxs" && <div className={labelClass}>{label}</div>}
        </div>
    );
};
