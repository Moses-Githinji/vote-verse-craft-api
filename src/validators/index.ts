import { z } from 'zod';

export const organizationSchema = z.object({
  orgType: z.enum(['school', 'sacco', 'church', 'political']),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const voterSchema = z.object({
  name: z.string().min(2).max(255),
  authCredential: z.string().min(1).max(255),
  stream: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().regex(/^\\+?\\d{10,15}$/).optional().or(z.literal('')),
});

export const electionSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(1000).optional(),
  electionType: z.string(),
  votingMethod: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  settings: z.record(z.string(), z.any()).optional(),
  candidates: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    manifesto: z.string().optional()
  })).optional()
});
