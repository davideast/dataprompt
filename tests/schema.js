import { z } from 'genkit'

export const TestSchema = z.object({
  data: z.string(),
  explanation: z.string(),
})
