export const successResponse = (data: any, message = 'Successful', meta?: any) => {
    const response: any = {
        success: true,
        message,
        data,
    };

    if (meta) {
        response.meta = meta;
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