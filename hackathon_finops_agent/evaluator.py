from config import TAG_UNDER_REVIEW, TAG_WARNING, TAG_ZOMBIE
from config import THRESHOLD_REVIEW, THRESHOLD_WARNING, THRESHOLD_ZOMBIE

def evaluate_table(usage_count, age_days, has_downstream, current_tags):
    """
    Enforces strict type boundaries to guarantee deterministic, non-crashing 
    behavior for malformed inputs.
    
    Returns: (State, Reason) or (None, Reason) for no-ops.
    """
    # 1. STRICT TYPE GUARD
    if type(usage_count) is not int or type(age_days) is not int:
        return "UNDER_REVIEW", "Insufficient or malformed metadata"
        
    if type(has_downstream) is not bool:
        return "UNDER_REVIEW", "Malformed lineage metadata"

    # 2. EXCLUSIONS & USAGE OF ALL PARAMETERS
    if has_downstream:
        return None, "No action required (Has downstream dependencies)"
        
    if usage_count > 0:
        return None, "No action required (Active usage)"

    # 3. DETERMINISTIC STATE ROUTING & IDEMPOTENCY
    if age_days >= THRESHOLD_ZOMBIE:
        if TAG_ZOMBIE in current_tags:
            return None, "No-op (already in desired state)"
        return "ZOMBIE", f"0 usage and 0 downstream for {age_days} days"
        
    if age_days >= THRESHOLD_WARNING:
        if any(tag in current_tags for tag in [TAG_WARNING, TAG_ZOMBIE]):
            return None, "No-op (already in desired state)"
        return "WARNING", f"0 usage and 0 downstream for {age_days} days"
        
    if age_days >= THRESHOLD_REVIEW:
        if any(tag in current_tags for tag in [TAG_UNDER_REVIEW, TAG_WARNING, TAG_ZOMBIE]):
            return None, "No-op (already in desired state)"
        return "UNDER_REVIEW", f"0 usage and 0 downstream for {age_days} days"

    # 4. DEFAULT
    return None, "No action required (Table too new)"
