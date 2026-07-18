export default function sendResponse(res, statusCode, message = "", data = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
}
