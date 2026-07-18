class customError extends Error {
  constructor(statusCode, message) {
    super(message);

    this.statusCode = statusCode;
    this.status = "error";

    Error.captureStackTrace(this, this.constructor);
  }
}

export default customError;
