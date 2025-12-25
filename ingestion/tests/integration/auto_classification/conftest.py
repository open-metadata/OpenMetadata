import os

import pytest
from testcontainers.postgres import PostgresContainer

from _openmetadata_testutils.factories.metadata.generated.schema.api.classification.create_classification import (
    CreateClassificationRequestFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.api.classification.create_tag import (
    CreateTagRequestFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    RecognizerFactory,
)
from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.piiEntity import PIIEntity
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import Recognizer
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@pytest.fixture(scope="module")
def postgres_container():
    """Start a PostgreSQL container with the test database."""
    init_file = os.path.join(os.path.dirname(__file__), "init.sql")
    container = PostgresContainer("postgres:15", dbname="test_db").with_volume_mapping(
        init_file, "/docker-entrypoint-initdb.d/init.sql"
    )

    with (
        try_bind(container, 5432, 5432) if not os.getenv("CI") else container
    ) as container:
        yield container


@pytest.fixture(scope="session")
def credit_card_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="credit_card_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.CreditCardRecognizer,
    )


@pytest.fixture(scope="session")
def aba_routing_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="aba_routing_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.AbaRoutingRecognizer,
    )


@pytest.fixture(scope="session")
def crypto_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="crypto_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.CryptoRecognizer,
    )


@pytest.fixture(scope="session")
def date_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="date_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.DateRecognizer,
    )


@pytest.fixture(scope="session")
def email_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="email_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.EmailRecognizer,
    )


@pytest.fixture(scope="session")
def iban_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="iban_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.IbanRecognizer,
    )


@pytest.fixture(scope="session")
def ip_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="ip_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.IpRecognizer,
    )


@pytest.fixture(scope="session")
def nhs_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="nhs_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.NhsRecognizer,
    )


@pytest.fixture(scope="session")
def medical_license_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="medical_license_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.MedicalLicenseRecognizer,
    )


@pytest.fixture(scope="session")
def phone_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="phone_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.PhoneRecognizer,
    )


@pytest.fixture(scope="session")
def sg_fin_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="sg_fin_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.SgFinRecognizer,
    )


@pytest.fixture(scope="session")
def url_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="url_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UrlRecognizer,
    )


@pytest.fixture(scope="session")
def us_bank_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_bank_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsBankRecognizer,
    )


@pytest.fixture(scope="session")
def us_itin_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_itin_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsItinRecognizer,
    )


@pytest.fixture(scope="session")
def us_license_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_license_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsLicenseRecognizer,
    )


@pytest.fixture(scope="session")
def us_passport_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_passport_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsPassportRecognizer,
    )


@pytest.fixture(scope="session")
def us_ssn_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_ssn_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsSsnRecognizer,
    )


@pytest.fixture(scope="session")
def es_nif_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="es_nif_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.EsNifRecognizer,
    )


@pytest.fixture(scope="session")
def pii_spacy_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="spacy_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.SpacyRecognizer,
        recognizerConfig__supportedEntities=[
            PIIEntity.PERSON,
        ],
    )


@pytest.fixture(scope="session")
def non_pii_spacy_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="spacy_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.SpacyRecognizer,
        recognizerConfig__supportedEntities=[
            PIIEntity.LOCATION,
            PIIEntity.DATE_TIME,
        ],
    )


@pytest.fixture(scope="session")
def au_abn_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="au_abn_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.AuAbnRecognizer,
    )


@pytest.fixture(scope="session")
def au_acn_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="au_acn_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.AuAcnRecognizer,
    )


@pytest.fixture(scope="session")
def au_tfn_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="au_tfn_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.AuTfnRecognizer,
    )


@pytest.fixture(scope="session")
def au_medicare_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="au_medicare_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.AuMedicareRecognizer,
    )


@pytest.fixture(scope="session")
def it_driver_license_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="it_driver_license_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.ItDriverLicenseRecognizer,
    )


@pytest.fixture(scope="session")
def it_fiscal_code_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="it_fiscal_code_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.ItFiscalCodeRecognizer,
    )


@pytest.fixture(scope="session")
def it_vat_code_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="it_vat_code_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.ItVatCodeRecognizer,
    )


@pytest.fixture(scope="session")
def it_identity_card_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="it_identity_card_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.ItIdentityCardRecognizer,
    )


@pytest.fixture(scope="session")
def it_passport_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="it_passport_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.ItPassportRecognizer,
    )


@pytest.fixture(scope="session")
def in_pan_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="in_pan_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.InPanRecognizer,
    )


@pytest.fixture(scope="session")
def pl_pesel_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="pl_pesel_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.PlPeselRecognizer,
    )


@pytest.fixture(scope="session")
def in_aadhaar_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="in_aadhaar_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.InAadhaarRecognizer,
    )


@pytest.fixture(scope="session")
def in_vehicle_registration_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="in_vehicle_registration_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.InVehicleRegistrationRecognizer,
    )


@pytest.fixture(scope="session")
def sg_uen_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="sg_uen_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.SgUenRecognizer,
    )


@pytest.fixture(scope="session")
def in_voter_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="in_voter_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.InVoterRecognizer,
    )


@pytest.fixture(scope="session")
def in_passport_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="in_passport_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.InPassportRecognizer,
    )


@pytest.fixture(scope="session")
def fi_personal_identity_code_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="fi_personal_identity_code_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.FiPersonalIdentityCodeRecognizer,
    )


@pytest.fixture(scope="session")
def es_nie_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="es_nie_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.EsNieRecognizer,
    )


@pytest.fixture(scope="session")
def uk_nino_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="uk_nino_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UkNinoRecognizer,
    )


@pytest.fixture(scope="session")
def person_column_name_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="person_column_name_recognizer",
        recognizerConfig__type="pattern",
        recognizerConfig__patterns__0__regex=r"^.*(user|client|person|first|last|maiden|nick).*(name).*$",
        for_column_name=True,
    )


@pytest.fixture(scope="session")
def pii_classification(
    metadata: OpenMetadata[Classification, CreateClassificationRequest]
) -> Classification:
    create_classification_request = CreateClassificationRequestFactory.create(fqn="PII")
    entity = metadata.create_or_update(create_classification_request)

    return entity


@pytest.fixture(scope="session")
def sensitive_pii_tag(
    metadata: OpenMetadata[Tag, CreateTagRequest],
    pii_classification: Classification,
    credit_card_recognizer: Recognizer,
    aba_routing_recognizer: Recognizer,
    crypto_recognizer: Recognizer,
    email_recognizer: Recognizer,
    iban_recognizer: Recognizer,
    nhs_recognizer: Recognizer,
    medical_license_recognizer: Recognizer,
    sg_fin_recognizer: Recognizer,
    us_bank_recognizer: Recognizer,
    us_itin_recognizer: Recognizer,
    us_license_recognizer: Recognizer,
    us_passport_recognizer: Recognizer,
    us_ssn_recognizer: Recognizer,
    es_nif_recognizer: Recognizer,
    pii_spacy_recognizer: Recognizer,
    au_abn_recognizer: Recognizer,
    au_acn_recognizer: Recognizer,
    au_tfn_recognizer: Recognizer,
    au_medicare_recognizer: Recognizer,
    it_driver_license_recognizer: Recognizer,
    it_fiscal_code_recognizer: Recognizer,
    it_vat_code_recognizer: Recognizer,
    it_identity_card_recognizer: Recognizer,
    it_passport_recognizer: Recognizer,
    in_pan_recognizer: Recognizer,
    pl_pesel_recognizer: Recognizer,
    in_aadhaar_recognizer: Recognizer,
    sg_uen_recognizer: Recognizer,
    in_voter_recognizer: Recognizer,
    in_passport_recognizer: Recognizer,
    fi_personal_identity_code_recognizer: Recognizer,
    es_nie_recognizer: Recognizer,
    uk_nino_recognizer: Recognizer,
    person_column_name_recognizer: Recognizer,
) -> Tag:
    create_tag_request: CreateTagRequest = CreateTagRequestFactory.create(
        tag_name="Sensitive",
        tag_classification=pii_classification.fullyQualifiedName.root,
        recognizers=[
            credit_card_recognizer,
            aba_routing_recognizer,
            crypto_recognizer,
            email_recognizer,
            iban_recognizer,
            nhs_recognizer,
            medical_license_recognizer,
            sg_fin_recognizer,
            us_bank_recognizer,
            us_itin_recognizer,
            us_license_recognizer,
            us_passport_recognizer,
            us_ssn_recognizer,
            es_nif_recognizer,
            pii_spacy_recognizer,
            au_abn_recognizer,
            au_acn_recognizer,
            au_tfn_recognizer,
            au_medicare_recognizer,
            it_driver_license_recognizer,
            it_fiscal_code_recognizer,
            it_vat_code_recognizer,
            it_identity_card_recognizer,
            it_passport_recognizer,
            in_pan_recognizer,
            pl_pesel_recognizer,
            in_aadhaar_recognizer,
            sg_uen_recognizer,
            in_voter_recognizer,
            in_passport_recognizer,
            fi_personal_identity_code_recognizer,
            es_nie_recognizer,
            uk_nino_recognizer,
            person_column_name_recognizer,
        ],
    )
    return metadata.create_or_update(create_tag_request)


@pytest.fixture(scope="session")
def non_sensitive_pii_tag(
    metadata: OpenMetadata[Tag, CreateTagRequest],
    pii_classification: Classification,
    date_recognizer: Recognizer,
    phone_recognizer: Recognizer,
    non_pii_spacy_recognizer: Recognizer,
) -> Tag:
    create_tag_request: CreateTagRequest = CreateTagRequestFactory.create(
        tag_name="NonSensitive",
        tag_classification=pii_classification.fullyQualifiedName.root,
        recognizers=[
            date_recognizer,
            phone_recognizer,
            non_pii_spacy_recognizer,
        ],
    )
    return metadata.create_or_update(create_tag_request)
