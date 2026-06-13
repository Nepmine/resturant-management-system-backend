export function apiResponse(data: unknown, message = 'Success') {
  return { success: true, message, data }
}
