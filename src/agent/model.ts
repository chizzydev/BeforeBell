import {
  BedrockModel,
} from "@strands-agents/sdk";

export const BEFOREBELL_MODEL_ID =
  "global.anthropic.claude-sonnet-4-6";

export const BEFOREBELL_AWS_REGION =
  "us-east-1";

export function createBeforeBellModel() {
  return new BedrockModel({
    modelId: BEFOREBELL_MODEL_ID,
    region: BEFOREBELL_AWS_REGION,
    temperature: 0.1,
    maxTokens: 1400,
  });
}