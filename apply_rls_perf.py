import re
import os

filepath = 'c:/Users/design/Desktop/dev/campobranco/supabase/schema.sql'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# auth.uid() -> (select auth.uid())
text = re.sub(r'\bauth\.uid\(\)', '(select auth.uid())', text)

# get_auth_role() -> (select public.get_auth_role())
text = re.sub(r'\bget_auth_role\(\)', '(select public.get_auth_role())', text)
text = text.replace('CREATE OR REPLACE FUNCTION public.(select public.get_auth_role())', 'CREATE OR REPLACE FUNCTION public.get_auth_role()')
text = text.replace('DROP FUNCTION IF EXISTS public.(select public.get_auth_role()) CASCADE;', 'DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;')

# get_auth_congregation() -> (select public.get_auth_congregation())
text = re.sub(r'\bget_auth_congregation\(\)', '(select public.get_auth_congregation())', text)
text = text.replace('CREATE OR REPLACE FUNCTION public.(select public.get_auth_congregation())', 'CREATE OR REPLACE FUNCTION public.get_auth_congregation()')
text = text.replace('DROP FUNCTION IF EXISTS public.(select public.get_auth_congregation()) CASCADE;', 'DROP FUNCTION IF EXISTS public.get_auth_congregation() CASCADE;')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Replacement complete.")
