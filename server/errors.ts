export class SourceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "invalid_source",
  ) {
    super(message);
    this.name = "SourceError";
  }
}
