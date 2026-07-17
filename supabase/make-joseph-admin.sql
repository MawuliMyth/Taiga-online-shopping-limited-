update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('josephmawulemensah04@gmail.com')
);
