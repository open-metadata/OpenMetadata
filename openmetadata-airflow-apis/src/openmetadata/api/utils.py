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

import importlib
import logging
import os
import sys

from flask_jwt_extended.view_decorators import jwt_required, verify_jwt_in_request
from flask_login.utils import _get_user


def import_path(path):
    module_name = os.path.basename(path).replace("-", "_")
    spec = importlib.util.spec_from_loader(
        module_name, importlib.machinery.SourceFileLoader(module_name, path)
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.modules[module_name] = module
    return module


# Function used to validate the JWT Token
def jwt_token_secure(func):
    def jwt_secure_check(arg):
        logging.info("Rest_API_Plugin.jwt_token_secure() called")
        if not _get_user().is_anonymous:
            return func(arg)

        verify_jwt_in_request()
        return jwt_required(func(arg))

    return jwt_secure_check
