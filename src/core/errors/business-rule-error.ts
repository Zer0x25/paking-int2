/** A user-facing domain rejection, distinct from infrastructure/runtime failures. */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
