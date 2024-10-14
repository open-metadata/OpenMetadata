import axios, { AxiosError } from "axios";

interface ErrorResponseData {
    details?: string | string[]; // details can be a string or an array of strings
}

export const getAxiosErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        // The error is an AxiosError
        const axiosError = error as AxiosError<ErrorResponseData>;

        const errorDetails = axiosError.response?.data?.details;

        let errorMessage = 'Unknown error occurred';

        if (Array.isArray(errorDetails)) {
            // If 'details' is an array, ensure each element is converted to a string
            errorMessage = errorDetails
                .map((detail) =>
                    typeof detail === 'string'
                        ? detail
                        : JSON.stringify(detail, null, 2) // Convert objects to string
                )
                .join('\n');
        } else if (typeof errorDetails === 'string') {
            // If 'details' is a string, use it directly
            errorMessage = errorDetails;
        }

        return errorMessage;
    }

    // If the error is not an AxiosError, return the error message as string
    return String(error);
};