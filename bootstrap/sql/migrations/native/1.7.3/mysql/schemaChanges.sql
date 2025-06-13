-- remove old reset link email template
DELETE from doc_Store where name = 'reset-link' and entityType = 'EmailTemplate';

