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
Snowflake module to define constants 
"""


# checkout the region reference map here:
# https://docs.snowflake.com/en/user-guide/admin-account-identifier#region-ids

SNOWFLAKE_REGION_ID_MAP = {
    "aws_us_west_2": "us-west-2",
    "aws_us_gov_west_1": "us-gov-west-1",
    "aws_us_gov_west_1_fhplus": "fhplus.us-gov-west-1.aws",
    "aws_us_east_2": "us-east-2",
    "aws_us_east_1": "us-east-1",
    "aws_us_east_1_gov": "us-east-1",
    "aws_ca_central_1": "ca-central-1",
    "aws_sa_east_1": "sa-east-1",
    "aws_eu_west_2": "eu-west-2",
    "aws_eu_west_3": "eu-west-3",
    "aws_eu_central_1": "eu-central-1",
    "aws_eu_north_1": "eu-north-1",
    "aws_ap_northeast_1": "ap-northeast-1",
    "aws_ap_northeast_2": "ap-northeast-2",
    "aws_ap_northeast_3": "ap-northeast-3",
    "aws_ap_south_1": "ap-south-1",
    "aws_ap_southeast_1": "ap-southeast-1",
    "aws_ap_southeast_2": "ap-southeast-2",
    "aws_ap_southeast_3": "ap-southeast-3",
    "gcp_us_central1": "us-central1",
    "gcp_us_east4": "us-east4",
    "gcp_europe_west2": "europe-west2",
    "azure_westus2": "westus2",
    "azure_centralus": "centralus",
    "azure_southcentralus": "southcentralus",
    "azure_eastus2": "eastus2",
    "azure_usgovvirginia": "usgovvirginia",
    "azure_canadacentral": "canadacentral",
    "azure_uksouth": "uk-south",
    "azure_northeurope": "northeurope",
    "azure_westeurope": "westeurope",
    "azure_switzerlandnorth": "switzerlandnorth",
    "azure_uaenorth": "uaenorth",
    "azure_centralindia": "central-india.azure",
    "azure_japaneast": "japaneast",
    "azure_southeastasia": "southeastasia",
    "azure_australiaeast": "australiaeast",
}
