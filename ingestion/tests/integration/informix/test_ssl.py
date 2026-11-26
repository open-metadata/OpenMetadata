#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""The SSL helpers run inside the JVM, so they are tested against a real one.

No Informix server is involved: the helpers produce what the driver is handed --
a truststore file and the JVM default SSLContext -- and that is what is checked.
"""

import datetime

import jpype
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from metadata.ingestion.source.database.informix.dialect import (
    TRUSTSTORE_PASSWORD,
    _trusting_any_server_certificate,
    build_truststore,
)


def self_signed_pem(common_name: str) -> str:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    return certificate.public_bytes(serialization.Encoding.PEM).decode()


def trusted_subjects(path: str) -> set[str]:
    keystore = jpype.JClass("java.security.KeyStore").getInstance("JKS")
    stream = jpype.JClass("java.io.FileInputStream")(path)
    try:
        keystore.load(stream, jpype.JString(TRUSTSTORE_PASSWORD).toCharArray())
    finally:
        stream.close()
    return {
        str(keystore.getCertificate(alias).getSubjectX500Principal().getName())
        for alias in keystore.aliases()
        if keystore.isCertificateEntry(alias)
    }


class TestTruststore:
    def test_every_certificate_in_the_pem_is_trusted(self):
        """A CA bundle carries its chain; dropping all but the first breaks verification."""
        bundle = self_signed_pem("root-ca") + self_signed_pem("intermediate-ca")
        assert trusted_subjects(build_truststore(bundle)) == {"CN=root-ca", "CN=intermediate-ca"}

    def test_indented_pem_is_accepted(self):
        """YAML block scalars keep their indentation, which CertificateFactory rejects."""
        indented = "\n".join(f"    {line}" for line in self_signed_pem("yaml-ca").splitlines())
        assert trusted_subjects(build_truststore(indented)) == {"CN=yaml-ca"}


class TestTrustAnyServerCertificate:
    def test_the_jvm_default_is_restored_after_the_handshake(self):
        ssl_context = jpype.JClass("javax.net.ssl.SSLContext")
        verifying = ssl_context.getDefault()
        with _trusting_any_server_certificate():
            assert not ssl_context.getDefault().equals(verifying)
        assert ssl_context.getDefault().equals(verifying)
