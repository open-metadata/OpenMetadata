-- remove old reset link email template
DELETE from doc_store where name = 'reset-link' and entityType = 'EmailTemplate';