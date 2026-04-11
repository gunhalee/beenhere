-- Remove guest-to-member merge artifacts after deprecating account migration.

DROP FUNCTION IF EXISTS public.merge_guest_account(uuid, uuid);

DROP TABLE IF EXISTS public.account_merges;
DROP TABLE IF EXISTS public.guest_conversion_events;
