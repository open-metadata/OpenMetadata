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
"""Check installed Python trust stores, optionally exercising live TLS chains."""

import argparse
import ensurepip
import hashlib
import importlib.metadata
import importlib.util
import logging
import os
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
from pathlib import Path

import certifi
from pip._vendor import certifi as pip_certifi
from pip._vendor.packaging.version import Version

# https://emudhra.we-have-a-problem.com/roots.json
BLOCKED_ROOTS = {
    "d7a7a0fb5d7e2731d771e9484ebcdef71d5f0c3e0a2948782bc83ee0ea699ef4",
    "86a1ecba089c4a8d3bbe2734c612ba341d813e043cf9e8a862cd5c57a36bbe6b",
}
BAD_HOSTS = (
    "dv-g3b-emudhra.we-have-a-problem.com",
    "dv-g3b-aaa-emudhra.we-have-a-problem.com",
)


def verify_packages():
    floors = {"pip": "26.2.2", "certifi": "2026.10.19", "uv": "0.13.4", "virtualenv": "21.14.12"}
    for distribution in importlib.metadata.distributions():
        name = distribution.metadata["Name"].lower()
        if name in floors and Version(distribution.version) < Version(floors[name]):
            raise RuntimeError(f"Vulnerable {name} {distribution.version} at {distribution.locate_file('')}")
    for name in ("pip", "certifi"):
        logging.info("%s=%s", name, importlib.metadata.version(name))
    if Version(ensurepip.version()) < Version(floors["pip"]):
        raise RuntimeError(f"Vulnerable ensurepip wheel: {ensurepip.version()}")
    logging.info("ensurepip=%s", ensurepip.version())
    isolated_uv = Path("/home/airflow/.local/share/uv/tools/prek/bin/uv")
    if isolated_uv.is_file() and os.environ.get("PREK_NATIVE_TLS") != "true":
        raise RuntimeError("prek must use the patched OS trust store")
    for binary in (shutil.which("uv"), str(isolated_uv) if isolated_uv.is_file() else None):
        if binary:
            version = subprocess.check_output([binary, "--version"], text=True).split()[1]
            if Version(version) < Version(floors["uv"]):
                raise RuntimeError(f"Vulnerable uv binary: {binary} {version}")


def verify_connections(name, context):
    for host in ("pypi.org", *BAD_HOSTS):
        try:
            with (
                socket.create_connection((host, 443), timeout=20) as connection,
                context.wrap_socket(connection, server_hostname=host),
            ):
                pass
        except ssl.SSLCertVerificationError:
            if host not in BAD_HOSTS:
                raise
            logging.info("%s: rejected %s", name, host)
        else:
            if host in BAD_HOSTS:
                raise RuntimeError(f"{name} trusted {host}")
            logging.info("%s: accepted %s", name, host)


def verify_bundle(name, bundle, network):
    if not bundle:
        raise RuntimeError(f"Missing {name} CA bundle")
    context = ssl.create_default_context(cafile=bundle)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    fingerprints = {hashlib.sha256(certificate).hexdigest() for certificate in context.get_ca_certs(binary_form=True)}
    if not fingerprints or fingerprints & BLOCKED_ROOTS:
        raise RuntimeError(f"Unsafe {name} CA bundle: {bundle}")
    logging.info("%s CA bundle: patched", name)
    if network:
        verify_connections(name, context)


def verify_seeds(network):
    factories = {"venv": ["-m", "venv"]}
    if importlib.util.find_spec("virtualenv"):
        factories["virtualenv"] = ["-m", "virtualenv", "--no-download", "--no-periodic-update"]
    for name, arguments in factories.items():
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable, *arguments, directory], check=True)
            probe = (
                "import pip; from pip._vendor import certifi; "
                "from pip._vendor.packaging.version import Version; "
                "assert Version(pip.__version__) >= Version('26.2.2'), pip.__version__; "
                "print(certifi.where())"
            )
            bundle = subprocess.check_output([str(Path(directory) / "bin/python"), "-c", probe], text=True).strip()
            verify_bundle(name, bundle, network)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    verify_packages()
    bundles = {"certifi": certifi.where(), "pip": pip_certifi.where(), "system": ssl.get_default_verify_paths().cafile}
    if importlib.util.find_spec("botocore"):
        bundles["botocore"] = importlib.import_module("botocore.httpsession").get_cert_path(True)
    if importlib.util.find_spec("httplib2"):
        bundles["httplib2"] = importlib.import_module("httplib2").CA_CERTS
    if spec := importlib.util.find_spec("grpc"):
        bundles["grpc"] = os.environ.get("GRPC_DEFAULT_SSL_ROOTS_FILE_PATH") or str(
            Path(spec.origin).parent / "_cython/_credentials/roots.pem"
        )
    for name, bundle in bundles.items():
        verify_bundle(name, bundle, args.network)
    verify_seeds(args.network)


if __name__ == "__main__":
    main()
