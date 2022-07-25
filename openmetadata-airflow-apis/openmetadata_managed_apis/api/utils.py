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
from typing import Optional
import re

from flask import request
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


def clean_dag_id(raw_dag_id: Optional[str]) -> Optional[str]:
    """
    Given a string we want to use as a dag_id, we should
    give it a cleanup as Airflow does not support anything
    that is not alphanumeric for the name
    """
    return re.sub("[^0-9a-zA-Z-_]+", "_", raw_dag_id) if raw_dag_id else None


def get_request_arg(req, arg) -> Optional[str]:
    return req.args.get(arg) or req.form.get(arg)


def get_arg_dag_id() -> Optional[str]:
    """
    Try to fetch the dag_id from the args
    and clean it
    """
    raw_dag_id = get_request_arg(request, "dag_id")

    return clean_dag_id(raw_dag_id)


def get_request_dag_id() -> Optional[str]:
    """
    Try to fetch the dag_id from the JSON request
    and clean it
    """
    raw_dag_id = request.get_json().get("dag_id")

    return clean_dag_id(raw_dag_id)
