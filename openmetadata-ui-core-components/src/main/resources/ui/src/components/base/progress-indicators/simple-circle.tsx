export const CircleProgressBar = (props: {
  value: number;
  min?: number;
  max?: number;
}) => {
  const { value, min = 0, max = 100 } = props;
  const range = max - min;
  let rawPercentage: number;

  if (range <= 0) {
    rawPercentage = value >= max ? 100 : 0;
  } else {
    rawPercentage = ((value - min) * 100) / range;
  }

  const percentage = Math.min(100, Math.max(0, rawPercentage));

  return (
    <div
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      className="tw:relative tw:flex tw:w-max tw:items-center tw:justify-center"
      role="progressbar">
      <span className="tw:absolute tw:text-sm tw:font-medium tw:text-primary">
        {percentage}%
      </span>
      <svg className="tw:size-16 tw:-rotate-90" viewBox="0 0 60 60">
        <circle
          className="tw:stroke-bg-quaternary"
          cx="30"
          cy="30"
          fill="none"
          r="26"
          strokeWidth="6"
        />
        <circle
          className="tw:stroke-fg-brand-primary"
          cx="30"
          cy="30"
          fill="none"
          pathLength="100"
          r="26"
          strokeDasharray="100"
          strokeLinecap="round"
          strokeWidth="6"
          style={{
            strokeDashoffset: `calc(100 - ${percentage})`,
          }}
        />
      </svg>
    </div>
  );
};
