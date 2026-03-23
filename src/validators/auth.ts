import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const voterLoginSchema = z.object({
  authCredential: z.string().min(1),
  electionId: z.string().optional(),
});

export const getOrgIdFromType = (type: string) => {
  // In a real application, you might query the DB to get the OrgId by type if there's only 1 org per type
  // or use the current subdomain to identify the org.
  return type;
};
