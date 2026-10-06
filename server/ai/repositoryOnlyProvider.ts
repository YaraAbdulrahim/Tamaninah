/**
 * Journey/direct learning never call the model. This object only satisfies the orchestrator's
 * `{ name }` parameter (response mode); calling `complete` is a programming error.
 */
export const repositoryOnlyProvider = {
  name: "repository" as const,
  async complete(): Promise<never> {
    throw new Error("Religious content is repository-only; this stage must not invoke an AI provider.");
  },
};
