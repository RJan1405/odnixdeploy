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
        console.log(`[ApiClient] POST ${endpoint}`, data);
        const body = data instanceof FormData ? data : JSON.stringify(data);
        const result = await this.request<T>(endpoint, {
            method: 'POST',
            body,
        });
        console.log(`[ApiClient] POST ${endpoint} - Response:`, result);
        return result;
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

    upload<T>(
        endpoint: string,
        formData: FormData,
        onProgress?: (progress: number) => void
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `${this.baseURL}${endpoint}`;
            const csrfToken = getCookie('csrftoken');

            xhr.open('POST', url, true);

            // Set credentials for session-based auth
            xhr.withCredentials = true;

            if (csrfToken) {
                xhr.setRequestHeader('X-CSRFToken', csrfToken);
            }

            // XHR automatically sets Content-Type for FormData

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        onProgress(percentComplete);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        // If response is not JSON
                        resolve({} as T);
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.error || errorData.message || `HTTP ${xhr.status}`));
                    } catch (e) {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                }
            };

            xhr.onerror = () => {
                reject(new Error('Network Error'));
            };

            xhr.send(formData);
        });
    }
}

export const apiClient = new ApiClient();
