import './GlassCard.css';

const GlassCard = ({ 
  children, 
  className = "", 
  hover = false, 
  variant = "default",
  onClick = undefined,
  ...props 
}) => {
  const baseClasses = "glass-card";
  const variantClasses = {
    default: "glass-card--default",
    primary: "glass-card--primary",
    secondary: "glass-card--secondary"
  };
  
  const hoverClass = hover ? "glass-card--hover" : "";
  const clickableClass = onClick ? "glass-card--clickable" : "";
  
  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    hoverClass,
    clickableClass,
    className
  ].filter(Boolean).join(" ");

  return (
    <div
      className={combinedClasses}
      onClick={onClick}
      {...props}
    >
      <div className="glass-card__gradient-border" />
      <div className="glass-card__content">
        {children}
      </div>
    </div>
  );
};

export { GlassCard };
export default GlassCard;
