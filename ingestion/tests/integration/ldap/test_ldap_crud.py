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
from time import sleep
from metadata.ingestion.models.user import MetadataUser, User
import pytest
from ldap3 import Server, Connection, ALL
import requests

headers = {'Content-type': 'application/json'}
url = 'http://localhost:8585/api/v1/users'


def read_user_by_name(name: str):
    r = requests.get(url + '/name/' + name)
    r.raise_for_status()
    bool = status(r)
    return [bool, r.json()]


def status(r):
    if r.status_code == 200 or r.status_code == 201:
        return 1
    else:
        return 0


def ldap_connection():
    s = Server('ldap://localhost:389', get_info=ALL)
    c = Connection(s, user="cn=admin,dc=example,dc=com", password="ldappassword")
    c.open()
    if not c.bind():
        print("LDAP Connection Unsuccessful")
        return False
    return [True, c]


@pytest.fixture(scope="session")
def openldap_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    sleep(10)
    return ldap_connection()


def test_ldap_connection(openldap_service):
    c = openldap_service
    if 'listening' in str(c[1]):
        assert 1


def test_insert_user(openldap_service):
    c = openldap_service
    if c[0]:
        user = User('john_doe@example.com',
                    'John',
                    'Doe',
                    'John Doe',
                    'john_doe',
                    '', '', '', True,
                    0)
        metadata_user = MetadataUser(name=user.github_username,
                                     display_name=user.name,
                                     email=user.email)
        r = requests.post(url, data=metadata_user.to_json(), headers=headers)
        r.raise_for_status()
        if r.status_code == 200 or r.status_code == 201:
            assert 1
        else:
            assert 0
    else:
        logging.error('OpenLDAP not running')
        assert 0


def test_read_user():
    assert read_user_by_name('john_doe')[0]


def test_update_user(openldap_service):
    c = openldap_service
    if c[0]:
        user = read_user_by_name('john_doe')
        user[1]['displayName'] = 'Jane Doe'
        metadata_user = MetadataUser(name=user[1]['name'],
                                     display_name=user[1]['displayName'],
                                     email=user[1]['name'])

        r = requests.patch(url, data=metadata_user.to_json(), headers=headers)


def test_delete_user(openldap_service):
    c = openldap_service
    if c[0]:
        r = read_user_by_name('john_doe')
        r = requests.delete(url + '/{}'.format(r[1]['id']))
        r.raise_for_status()
        assert 1
    else:
        assert 0
