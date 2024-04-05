#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.


"""
Module to manage SSL certificates
"""
import os
import tempfile


class SSLManager:
    def __init__(self, ca, key, cert):
        self.ca = ca
        self.key = key
        self.cert = cert
        self.temp_files = []

    def create_temp_file(self, content):
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(content.encode())
            temp_file.close()
        self.temp_files.append(temp_file.name)
        return temp_file.name

    def cleanup_temp_files(self):
        for temp_file in self.temp_files:
            os.remove(temp_file)
        self.temp_files = []

    def setup_ssl(self):
        ca_file = self.create_temp_file(self.ca)
        key_file = self.create_temp_file(self.key)
        cert_file = self.create_temp_file(self.cert)

        # Use the temporary file paths for SSL configuration
        # Example code:
        # ssl_context = ssl.create_default_context(cafile=ca_file)
        # ssl_context.load_cert_chain(certfile=cert_file, keyfile=key_file)

        # Clean up the temporary files when done
        self.cleanup_temp_files()
