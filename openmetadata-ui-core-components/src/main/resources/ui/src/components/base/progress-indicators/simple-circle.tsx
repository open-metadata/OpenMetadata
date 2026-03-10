export const CircleProgressBar = (props: { value: number; min?: 0; max?: 100 }) => {
    const { value, min = 0, max = 100 } = props;
    const percentage = ((value - min) * 100) / (max - min);

    return (
        <div role="progressbar" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} className="tw:relative tw:flex tw:w-max tw:items-center tw:justify-center">
            <span className="tw:absolute tw:text-sm tw:font-medium tw:text-primary">{percentage}%</span>
            <svg className="tw:size-16 tw:-rotate-90" viewBox="0 0 60 60">
                <circle className="tw:stroke-bg-quaternary" cx="30" cy="30" r="26" fill="none" strokeWidth="6" />
                <circle
                    className="tw:stroke-fg-brand-primary"
                    style={{
                        strokeDashoffset: `calc(100 - ${percentage})`,
                    }}
                    cx="30"
                    cy="30"
                    r="26"
                    fill="none"
                    strokeWidth="6"
                    strokeDasharray="100"
                    pathLength="100"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
};
