import { error } from "console"

export const successResponse = (data: any, message = 'Successful') => {
    return {
        success: true,
        message,
        data
    }
}

export const errorResponse = (status: number, message: string, errorStack = "") => {
    return {
        success: false,
        error: {
            status,
            message,
            stack: errorStack
        }
    }
}