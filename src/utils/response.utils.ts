export const successResponse = (data: any, message = 'Successful', meta?: { total?: number; page?: number; limit?: number }) => {
    const response: any = {
        success: true,
        message,
        data,
    };

    if (meta) {
        response.meta = meta; // Include meta if provided (for paginated responses)
    }

    return response;
};

export const errorResponse = (status: number, message: string, errorStack = "") => {
    return {
        success: false,
        error: {
            status,
            message,
            stack: errorStack || undefined, // Include stack only if provided
        },
    };
};