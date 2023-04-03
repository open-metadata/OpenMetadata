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
Mixin class containing Glossaries specific methods

To be used be OpenMetadata
"""
import json
import traceback
from typing import Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.type import basic
from metadata.ingestion.ometa.mixins.patch_mixin_utils import (
    OMetaPatchMixinBase,
    PatchField,
    PatchOperation,
    PatchPath,
    PatchValue,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)


class GlossaryMixin(OMetaPatchMixinBase):
    """
    OpenMetadata API methods related to Glossaries.

    To be inherited by OpenMetadata
    """

    def create_glossary(self, glossaries_body):
        """Method to create new Glossary
        Args:
            glossaries_body (Glossary): body of the request
        """
        resp = self.client.put(
            path=self.get_suffix(Glossary), data=glossaries_body.json()
        )
        logger.info(f"Created a Glossary: {resp}")

    def create_glossary_term(self, glossary_term_body):
        """Method to create new Glossary Term
        Args:
            glossary_term_body (Glossary): body of the request
        """
        resp = self.client.put(
            path=self.get_suffix(GlossaryTerm), data=glossary_term_body.json()
        )
        logger.info(f"Created a Glossary Term: {resp}")

    def patch_glossary_term_parent(
        self,
        entity_id: Union[str, basic.Uuid],
        parent_fqn: Optional[str] = None,
    ) -> Optional[GlossaryTerm]:
        """
        Given an GlossaryTerm ID, JSON PATCH the parent. If parent FQN is not provided, the parent is removed.
        Args:
            entity_id: the ID of the GlossaryTerm to be patched
            parent_fqn: the fully qualified name of the new parent GlossaryTerm. If None the parent is removed.
        Return:
            the updated GlossaryTerm if all was valid, otherwise None
        """
        instance: GlossaryTerm = self._fetch_entity_if_exists(
            entity=GlossaryTerm, entity_id=entity_id
        )
        if not instance:
            return None

        if parent_fqn is not None:
            try:
                res = self.client.patch(
                    path=f"{self.get_suffix(GlossaryTerm)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD
                                if instance.parent is None
                                else PatchOperation.REPLACE,
                                PatchField.PATH: PatchPath.PARENT,
                                PatchField.VALUE: {
                                    PatchValue.TYPE: self.get_suffix(GlossaryTerm),
                                    PatchValue.FQN: model_str(parent_fqn),
                                },
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH parent for GlossaryTerm [{model_str(entity_id)}]: {exc}"
                )

        else:
            try:
                res = self.client.patch(
                    path=f"{self.get_suffix(GlossaryTerm)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.REMOVE,
                                PatchField.PATH: PatchPath.PARENT,
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH parent for GlossaryTerm [{entity_id}]: {exc}"
                )

        return None

    def patch_glossary_term_related_terms(
        self,
        entity_id: Union[str, basic.Uuid],
        related_term_id: Optional[Union[str, basic.Uuid]] = None,
    ) -> Optional[GlossaryTerm]:
        """
        Given an GlossaryTerm ID and a related term, JSON PATCH the related terms. If related term ID is not provided,
        the last term is removed.
        Args:
            entity_id: the ID of the GlossaryTerm to be patched
            related_term_id: the ID of the related term to be added. If the related term ID is None, the last term is
                removed.
        Return:
            the updated GlossaryTerm
        """
        instance: GlossaryTerm = self._fetch_entity_if_exists(
            entity=GlossaryTerm, entity_id=entity_id
        )
        if not instance:
            return None

        term_index: int = (
            len(instance.relatedTerms.__root__) - 1 if instance.relatedTerms else 0
        )

        if related_term_id is None:
            try:
                res = self.client.patch(
                    path=f"{self.get_suffix(GlossaryTerm)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.REMOVE,
                                PatchField.PATH: PatchPath.RELATED_TERMS.format(
                                    index=term_index
                                ),
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH parent for GlossaryTerm [{entity_id}]: {exc}"
                )

        else:
            related_term: GlossaryTerm = self.get_by_id(
                entity=GlossaryTerm, entity_id=related_term_id, fields=["*"]
            )
            if related_term is None:
                logger.error(
                    f"Unable to PATCH GlossaryTerm [{entity_id}], unknown related term id [{related_term_id}]."
                )
                return None

            try:
                res = self.client.patch(
                    path=f"{self.get_suffix(GlossaryTerm)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD,
                                PatchField.PATH: PatchPath.RELATED_TERMS.format(
                                    index=term_index + 1
                                ),
                                PatchField.VALUE: {
                                    PatchValue.DISPLAY_NAME: related_term.displayName,
                                    PatchValue.ID: model_str(related_term_id),
                                    PatchValue.NAME: model_str(related_term.name),
                                    PatchValue.TYPE: PatchValue.GLOSSARY_TERM,
                                },
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH parent for GlossaryTerm [{entity_id}]: {exc}"
                )

        return None

    def patch_reviewers(
        self,
        entity: Union[Type[Glossary], Type[GlossaryTerm]],
        entity_id: Union[str, basic.Uuid],
        reviewer_id: Optional[Union[str, basic.Uuid]] = None,
    ) -> Optional[T]:
        """
        Update the reviewers of a Glossary or GlossaryTerm. If the reviewer_id is included, the reviewer is added; if
        not, the last reviewer is removed.
        Args
            entity (T): Entity Type - Glossary or GlossaryTerm
            entity_id: ID of the entity to be updated
            reviewer_id: ID of the user to added as a reviewer or None to remove the last reviewer
        Return
            The updated entity
        """
        instance: Union[Glossary, GlossaryTerm] = self._fetch_entity_if_exists(
            entity=entity, entity_id=entity_id
        )
        if not instance:
            return None

        index: int = (
            len(instance.reviewers)
            if entity == Glossary
            else len(instance.reviewers.__root__)
        )

        if reviewer_id is not None:
            try:
                res = self.client.patch(
                    path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD,
                                PatchField.PATH: PatchPath.REVIEWERS.format(
                                    index=index
                                ),
                                PatchField.VALUE: {
                                    PatchValue.ID: model_str(reviewer_id),
                                    PatchValue.TYPE: PatchValue.USER,
                                },
                            }
                        ]
                    ),
                )
                return entity(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH reviewers for {entity.__class__.__name__} [{entity_id}]: {exc}"
                )

        else:
            if index == 0:
                logger.debug(
                    f"Unable to remove reviewer from {entity.__class__.__name__} [{entity_id}]. No current reviewers."
                )
                return None

            try:
                res = self.client.patch(
                    path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.REMOVE,
                                PatchField.PATH: PatchPath.REVIEWERS.format(
                                    index=index - 1
                                ),
                            }
                        ]
                    ),
                )
                return entity(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH reviewers for {entity.__class__.__name__} [{entity_id}]: {exc}"
                )

        return None

    def patch_glossary_term_synonyms(
        self,
        entity_id: Union[str, basic.Uuid],
        synonym: Optional[str] = None,
    ) -> Optional[GlossaryTerm]:
        """
        Update the synonyms of a Glossary Term via PATCH
        Params
            entity_id: entity ID of the Glossary Term
            synonym: if provided, the synonym is added. If None, the last synonym is removed.
        Return
            the updated entity
        """
        instance: GlossaryTerm = self._fetch_entity_if_exists(
            entity=GlossaryTerm, entity_id=entity_id
        )
        if not instance:
            return None

        index: int = len(instance.synonyms)

        if synonym is not None:
            try:
                res = self.client.patch(
                    path=PatchPath.GLOSSARY_TERMS.format(
                        entity_id=model_str(entity_id)
                    ),
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD,
                                PatchField.PATH: PatchPath.SYNONYMS.format(index=index),
                                PatchField.VALUE: synonym,
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH synonyms for GlossaryTerm [{entity_id}]: {exc}"
                )

        else:
            if index == 0:
                logger.debug(
                    f"Unable to remove synonyms from GlossaryTerm [{entity_id}]. No current synonyms."
                )
                return None

            try:
                res = self.client.patch(
                    path=PatchPath.GLOSSARY_TERMS.format(
                        entity_id=model_str(entity_id)
                    ),
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.REMOVE,
                                PatchField.PATH: PatchPath.SYNONYMS.format(
                                    index=index - 1
                                ),
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH synonyms for GlossaryTerm [{entity_id}]: {exc}"
                )

        return None

    def patch_glossary_term_references(
        self,
        entity_id: Union[str, basic.Uuid],
        reference_name: Optional[str] = None,
        reference_endpoint: Optional[str] = None,
    ) -> Optional[GlossaryTerm]:
        """
        Update the references of a GlossaryTerm. If reference_name and reference_endpoint are None, the last reference
        is removed.
        Params
            entity_id: ID of the GlossaryTerm
            reference_name: the name of the reference
            reference_endpoint: the valid URI endpoint of the reference
        Return
            updated GlossaryTerm
        """
        instance: GlossaryTerm = self._fetch_entity_if_exists(
            entity=GlossaryTerm, entity_id=entity_id
        )
        if not instance:
            return None

        index: int = len(instance.references)

        if bool(reference_name) ^ bool(reference_endpoint):
            logger.debug(
                f"Unable to PATCH references from GlossaryTerm [{entity_id}]: reference_name and references."
            )
            return None

        if reference_name is not None:
            try:
                res = self.client.patch(
                    path=PatchPath.GLOSSARY_TERMS.format(
                        entity_id=model_str(entity_id)
                    ),
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD,
                                PatchField.PATH: PatchPath.REFERENCES.format(
                                    index=index
                                ),
                                PatchField.VALUE: {
                                    PatchValue.ENDPOINT: reference_endpoint,
                                    PatchValue.NAME: reference_name,
                                },
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH references for GlossaryTerm [{entity_id}]: {exc}"
                )

        else:
            if index == 0:
                logger.debug(
                    f"Unable to remove reference from GlossaryTerm [{entity_id}]. No current references."
                )
                return None

            try:
                res = self.client.patch(
                    path=PatchPath.GLOSSARY_TERMS.format(
                        entity_id=model_str(entity_id)
                    ),
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.REMOVE,
                                PatchField.PATH: PatchPath.REFERENCES.format(
                                    index=index - 1
                                ),
                            }
                        ]
                    ),
                )
                return GlossaryTerm(**res)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error trying to PATCH references for GlossaryTerm [{entity_id}]: {exc}"
                )

        return None
