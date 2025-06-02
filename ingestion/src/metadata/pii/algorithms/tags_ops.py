from typing import Collection, Dict, Optional, Set

from metadata.pii.algorithms.tags import PIICategoryTag, PIISensitivityTag, PIITag


def categorize_pii_tag(pii_tag: PIITag) -> PIICategoryTag:
    """
    Categorize the PII tag into a broader category.
    """
    # return the category tag if the PII tag is in the category map
    # the category map is defined separately for better readability
    for category, tags in _CATEGORY_MAP.items():
        if pii_tag in tags:
            return category

    # This should never happen, as we should have unit tests to ensure all PII tags are categorized.
    raise ValueError(f"PII tag does not belong to any category: {pii_tag}")


def get_sensitivity_for_pii_category(
    pii_category_tag: PIICategoryTag,
) -> PIISensitivityTag:
    """
    Get the sensitivity level of the PIICategoryTag.
    This map is opinionated and can be changed in according to users' needs.
    """
    non_pii_sensitive = (
        PIICategoryTag.GENDER,
        PIICategoryTag.NRP,
        PIICategoryTag.DATE_TIME,
        PIICategoryTag.LOCATION,
        # FIXME: Do we really want to consider PHONE_NUMBER as non-sensitive?
        PIICategoryTag.PHONE_NUMBER,
        PIICategoryTag.URL,
    )
    if pii_category_tag in non_pii_sensitive:
        return PIISensitivityTag.NONSENSITIVE
    return PIISensitivityTag.SENSITIVE


def resolve_sensitivity(
    sensitivities: Collection[PIISensitivityTag],
) -> Optional[PIISensitivityTag]:
    """
    Resolve the sensitivity level from a list of PIISensitivityTag.
    Most restricted sensitivity is returned if multiple tags are present.
    """
    if not sensitivities:
        return None
    if PIISensitivityTag.SENSITIVE in sensitivities:
        return PIISensitivityTag.SENSITIVE
    return PIISensitivityTag.NONSENSITIVE


def get_sensitivity_for_pii(pii_tag: PIITag) -> PIISensitivityTag:
    """
    Get the sensitivity level of the PIITag.
    This map is opinionated and can be changed in the future according to users' needs.
    """
    pii_category_tag = categorize_pii_tag(pii_tag)
    return get_sensitivity_for_pii_category(pii_category_tag)


# Parent child aliases
_P = PIICategoryTag
_C = PIITag

# Define the PIITag's a PIICategoryTag contains
_CATEGORY_MAP: Dict[PIICategoryTag, Set[PIITag]] = {
    _P.PASSWORD: set(),
    _P.BANK_NUMBER: {_C.US_BANK_NUMBER},
    _P.CREDIT_CARD: {_C.CREDIT_CARD},
    _P.PERSON: {_C.PERSON},
    _P.GENDER: set(),
    _P.NRP: {_C.NRP},
    _P.ADDRESS: set(),
    _P.CRYPTO: {_C.CRYPTO},
    _P.DATE_TIME: {_C.DATE_TIME},
    _P.EMAIL_ADDRESS: {_C.EMAIL_ADDRESS},
    _P.IBAN_CODE: {_C.IBAN_CODE},
    _P.IP_ADDRESS: {_C.IP_ADDRESS},
    _P.LOCATION: {_C.LOCATION},
    _P.PHONE_NUMBER: {_C.PHONE_NUMBER},
    _P.MEDICAL_LICENSE: {_C.MEDICAL_LICENSE},
    _P.URL: {_C.URL},
    _P.DRIVER_LICENSE: {
        _C.US_DRIVER_LICENSE,
        _C.UK_NHS,
        _C.IT_DRIVER_LICENSE,
    },
    _P.NATIONAL_ID: {
        _C.US_ITIN,
        _C.US_SSN,
        _C.UK_NHS,
        _C.ES_NIF,
        _C.ES_NIE,
        _C.IT_FISCAL_CODE,
        _C.IT_PASSPORT,
        _C.IT_IDENTITY_CARD,
        _C.PL_PESEL,
        _C.SG_NRIC_FIN,
        _C.SG_UEN,
        _C.AU_ABN,
        _C.AU_ACN,
        _C.AU_TFN,
        _C.AU_MEDICARE,
        _C.IN_PAN,
        _C.IN_AADHAAR,
        _C.IN_VEHICLE_REGISTRATION,
        _C.IN_VOTER,
        _C.FI_PERSONAL_IDENTITY_CODE,
    },
    _P.PASSPORT: {
        _C.US_PASSPORT,
        _C.IT_PASSPORT,
        _C.IN_PASSPORT,
    },
    _P.VAT_CODE: {
        _C.IT_VAT_CODE,
        _C.AU_ABN,
        _C.AU_ACN,
        _C.AU_TFN,
    },
}
