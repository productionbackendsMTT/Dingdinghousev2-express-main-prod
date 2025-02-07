export const successResponse = (data: any, message = 'Successful') => {
    const response: any = {
        success: true,
        message,
        data,
    };

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