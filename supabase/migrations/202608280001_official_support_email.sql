update public.store_settings
set support_email = 'support@taigaonlineshoppinglimited.com',
    updated_at = now()
where id = 1
  and support_email = 'support@taiga.ng';
