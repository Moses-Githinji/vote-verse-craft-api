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
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']).optional(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  timezone: z.string().optional().default('UTC'),
  ballotQuestions: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['short', 'paragraph', 'single', 'multi', 'dropdown', 'file', 'linear', 'rating', 'grid_multiple', 'grid_checkbox', 'date', 'time', 'ranked', 'yesno']),
    title: z.string(),
    description: z.string().optional(),
    options: z.array(z.string()).default([]),
    optionImages: z.record(z.string(), z.string()).optional(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    allowWriteIn: z.boolean().default(false),
    allowNota: z.boolean().default(false),
    maxSelections: z.number().optional(),
    required: z.boolean().optional(),
    linearMin: z.number().optional(),
    linearMax: z.number().optional(),
    linearMinLabel: z.string().optional(),
    linearMaxLabel: z.string().optional(),
    ratingMax: z.number().optional(),
    gridRows: z.array(z.string()).optional(),
    gridColumns: z.array(z.string()).optional(),
    dateFormat: z.enum(['date', 'time', 'datetime']).optional(),
    fileTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
  })).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  candidates: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    manifesto: z.string().optional()
  })).optional()
});
