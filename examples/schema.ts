import { z } from "genkit";

export const InvoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  description: z.string(),
  status: z.enum(["paid", "pending", "overdue"]),
  processed: z.string().describe('ISO Date String')
});

export const Message = z.string();

export const SharkFact = z.object({
  fact: z.string(),
  dateString: z.string().describe('ISO Date String')
})


export const StorySchema = z.object({
  id: z.number(),
  by: z.string(),
  descendants: z.number().optional(),
  kids: z.array(z.number()).optional(),
  score: z.number(),
  time: z.number(),
  title: z.string(),
  type: z.string(),
  url: z.string().optional(),
  text: z.string().optional()
});

export const HNAnalysisSchema = z.object({
  top5: z.object({
    pageA: z.array(StorySchema),
    pageB: z.array(StorySchema),
  }).describe("Top 5 themes and topics for each page."),
  dominantThemesAndTopics: z.object({
    pageA: z.string(),
    pageB: z.string(),
  }).describe("Dominant themes and topics for each page."),
  keyDifferencesAndSimilarities: z.string().describe("Key differences and similarities between the themes and topics of the pages."),
  interestingInsightsTrendsPatterns: z.string().describe("Interesting insights, trends, patterns, or shifts observed in the comparison."),
  mostProminentThemes: z.object({
    pageA: z.array(z.string()),
    pageB: z.array(z.string()),
  }).describe("Most prominent themes for each page."),
  significantChanges: z.array(z.object({
    change: z.string().describe("Description of a significant change in themes, topics, or content types."),
  })).describe("Significant changes in themes, topics, or content types between the pages.").optional(),
});

export const HNPageAnalysis = z.object({
  dominantThemesAndTopics: z.record(z.string(), z.string()).describe("Dominant themes and topics for each page (page number as key, summary as value)."),
  keyDifferencesAndSimilarities: z.string().describe("Key differences and similarities between the themes and topics of the pages."),
  interestingInsightsTrendsPatterns: z.string().describe("Interesting insights, trends, patterns, or shifts observed in the comparison."),
  mostProminentThemes: z.record(z.string(), z.array(z.string())).describe("Most prominent themes shared by each page (page number as key, array of themes as value)."),
  significantChanges: z.array(z.object({
    change: z.string().describe("Description of a significant change in themes, topics, or content types."),
  })).describe("Significant changes in themes, topics, or content types between the pages.").optional(),
});