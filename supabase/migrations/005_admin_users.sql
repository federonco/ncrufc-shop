-- Admin users for HTTP Basic Auth (middleware validates against Supabase)
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert default admin accounts (passwords hashed with bcrypt, 10 rounds)
-- admin / 436449
-- NCRUFC / shoponline
INSERT INTO admin_users (username, password_hash)
VALUES
  ('admin', '$2b$10$FuqVfVVUKtgbJyJ8Yjgvi.lAIlMzEEm0hfin8qFfp94kWde1ZYJdy'),
  ('NCRUFC', '$2b$10$YbzmI79Yq0IvgNZMbt9mZO6ConvRIZB8lx1zgcypCPF6mVzfOXWa2')
ON CONFLICT (username) DO NOTHING;
