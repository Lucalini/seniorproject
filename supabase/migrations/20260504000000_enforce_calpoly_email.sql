-- Enforce @calpoly.edu email domain for user sign-ups
-- This trigger runs before INSERT on auth.users and rejects non-@calpoly.edu emails

CREATE OR REPLACE FUNCTION public.enforce_calpoly_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if email ends with @calpoly.edu (case-insensitive)
  IF NEW.email IS NULL OR NOT (LOWER(NEW.email) LIKE '%@calpoly.edu') THEN
    RAISE EXCEPTION 'Only @calpoly.edu email addresses are allowed to sign up.'
      USING HINT = 'Please use your Cal Poly email address.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
-- Note: This requires superuser/service_role privileges to modify auth schema
DROP TRIGGER IF EXISTS enforce_calpoly_email_trigger ON auth.users;

CREATE TRIGGER enforce_calpoly_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_calpoly_email();

-- Add comment for documentation
COMMENT ON FUNCTION public.enforce_calpoly_email() IS 
  'Validates that new user emails end with @calpoly.edu domain';
