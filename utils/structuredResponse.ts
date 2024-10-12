export const structuredResponse = (res, status, message, data) => {
    return res.status(status).json({
        status,
        message,
        data
    });
}