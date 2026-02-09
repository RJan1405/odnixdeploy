import { API_CONFIG } from '@/config/api.config';

// CSRF token helper
function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export class ApiClient {
    private baseURL: string;

    constructor() {
        this.baseURL = API_CONFIG.baseURL;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const csrfToken = getCookie('csrftoken');

        const headers: HeadersInit = {
            ...options.headers,
        };

        // Add CSRF token for non-GET requests
        if (options.method && options.method !== 'GET') {
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }
        }

        // Don't set Content-Type for FormData (browser will set it with boundary)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include', // Important for session-based auth
            });

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return {} as T;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('An unexpected error occurred');
        }
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    async post<T>(endpoint: string, data?: any): Promise<T> {
        const body = data instanceof FormData ? data : JSON.stringify(data);
        return this.request<T>(endpoint, {
            method: 'POST',
            body,
        });
    }

    async put<T>(endpoint: string, data?: any): Promise<T> {
        const body = data instanceof FormData ? data : JSON.stringify(data);
        return this.request<T>(endpoint, {
            method: 'PUT',
            body,
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }

    async patch<T>(endpoint: string, data?: any): Promise<T> {
        const body = data instanceof FormData ? data : JSON.stringify(data);
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body,
        });
    }
}

export const apiClient = new ApiClient();
