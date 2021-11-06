#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
import time
from datetime import datetime


import pytest
import requests
from ldap3 import ALL, Connection, Server

from metadata.ingestion.models.user import MetadataUser, User

headers = {"Content-type": "application/json"}
url = "http://localhost:8585/api/v1/users"

def sleep(timeout_s):
    print(f"sleeping for {timeout_s} seconds")
    n = len(str(timeout_s))
    for i in range(timeout_s, 0, -1):
        print(f"{i:>{n}}", end="\r", flush=True)
        time.sleep(1)
    print(f"{'':>{n}}", end="\n", flush=True)

def read_user_by_name(name: str):
    r = requests.get(url + "/name/" + name)
    r.raise_for_status()
    bool = status(r)
    return [bool, r.json()]


def status(r):
    if r.status_code == 200 or r.status_code == 201:
        return 1
    else:
        return 0

def ldap_connection():
    s = Server("ldap://localhost:389", get_info=ALL)
    c = Connection(s, user="cn=admin,dc=example,dc=com", password="ldappassword")
    c.open()
    if not c.bind():
        print("LDAP Connection Unsuccessful")
        return False
    return [True, c]

def is_ldap_listening(openldap_service):
    c = openldap_service
    if "listening" in str(c):
        return True

@pytest.fixture(scope="session")
def openldap_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    port = docker_services.port_for("openldap", 389)
    print(f"LDAP is running on port {port}")
    timeout_s = 10
    sleep(timeout_s)
    conn = ldap_connection()[1]
    docker_services.wait_until_responsive(
        timeout=timeout_s, pause=0.1, check=lambda: is_ldap_listening(conn)
    )
    return conn

@pytest.fixture(scope="session")
def ldap_user_entry(openldap_service):
    c = openldap_service
    c.search('cn=John Doe,ou=users,dc=example,dc=com', '(objectclass=person)', attributes=['*'])
    if c.entries:
        return c.entries[0]
    else:
        logging.error("OpenLDAP not running")
        assert 0

@pytest.fixture(scope="session")
def datetime_suffix():
    # Openmetadata doesn't delete users; it deactivates them.
    # Without changing the user's name with every run of this test,
    # the test will fail due to duplicate user in metadata.
    # Use a datetime suffix to have a new user name with every run.
    now = datetime.now()
    return now.strftime("_%Y%m%d%H%M%S")


def test_insert_user(ldap_user_entry, datetime_suffix):
    user = User(
        str(ldap_user_entry['mail']),
        str(ldap_user_entry['givenName']),
        str(ldap_user_entry['sn']),
        str(ldap_user_entry['cn']),
        str(ldap_user_entry['uid']) + datetime_suffix,
        "",
        "",
        "",
        True,
        0,
    )
    metadata_user = MetadataUser(
        name=user.github_username, display_name=user.name, email=user.email
    )
    r = requests.post(url, data=metadata_user.to_json(), headers=headers)
    r.raise_for_status()
    if r.status_code == 200 or r.status_code == 201:
        assert 1
    else:
        assert 0


def test_read_user(ldap_user_entry, datetime_suffix):
    assert read_user_by_name(str(ldap_user_entry['uid']) + datetime_suffix)[0]


def test_update_user(ldap_user_entry, datetime_suffix):
    user = read_user_by_name(str(ldap_user_entry['uid']) + datetime_suffix)
    user[1]["displayName"] = "Jane Doe"
    metadata_user = MetadataUser(
        name=user[1]["name"],
        display_name=user[1]["displayName"],
        email=user[1]["name"],
    )
    r = requests.patch(url, data=metadata_user.to_json(), headers=headers)


def test_delete_user(ldap_user_entry, datetime_suffix):
    r = read_user_by_name(str(ldap_user_entry['uid']) + datetime_suffix)
    r = requests.delete(url + "/{}".format(r[1]["id"]))
    r.raise_for_status()
    assert 1
