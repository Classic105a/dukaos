-- Create trigger function to auto-assign owner/admin users to ALL branches
CREATE OR REPLACE FUNCTION public.handle_branch_user_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  branch_record RECORD;
  user_role app_role;
BEGIN
  -- Get the user's role
  SELECT role INTO user_role FROM public.user_roles WHERE user_id = NEW.user_id;
  
  -- If owner or admin, assign to ALL active branches
  IF user_role IN ('owner', 'admin') THEN
    FOR branch_record IN SELECT id FROM public.branches WHERE is_active = true
    LOOP
      INSERT INTO public.branch_users (branch_id, user_id, is_default)
      VALUES (branch_record.id, NEW.user_id, false)
      ON CONFLICT (branch_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after role assignment
DROP TRIGGER IF EXISTS on_user_role_assigned ON public.user_roles;
CREATE TRIGGER on_user_role_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_branch_user_assignment();

-- Create function to assign new branches to owners/admins
CREATE OR REPLACE FUNCTION public.handle_new_branch_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner_record RECORD;
BEGIN
  -- Assign all owners and admins to the new branch
  FOR owner_record IN 
    SELECT user_id FROM public.user_roles WHERE role IN ('owner', 'admin')
  LOOP
    INSERT INTO public.branch_users (branch_id, user_id, is_default)
    VALUES (NEW.id, owner_record.user_id, false)
    ON CONFLICT (branch_id, user_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new branches
DROP TRIGGER IF EXISTS on_new_branch_created ON public.branches;
CREATE TRIGGER on_new_branch_created
  AFTER INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_branch_assignment();

-- Add unique constraint on branch_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branch_users_branch_id_user_id_key'
  ) THEN
    ALTER TABLE public.branch_users ADD CONSTRAINT branch_users_branch_id_user_id_key UNIQUE (branch_id, user_id);
  END IF;
END $$;

-- CRITICAL: Backfill existing owners/admins to all branches
INSERT INTO public.branch_users (branch_id, user_id, is_default)
SELECT b.id, ur.user_id, false
FROM public.branches b
CROSS JOIN public.user_roles ur
WHERE ur.role IN ('owner', 'admin') AND b.is_active = true
ON CONFLICT (branch_id, user_id) DO NOTHING;