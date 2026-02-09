// API Configuration
const getBaseUrl = () => {
    // FORCE relative path in browser to prevent Mixed Content issues
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:8000';
};

const getWsUrl = () => {
    if (import.meta.env.VITE_WS_BASE_URL) return import.meta.env.VITE_WS_BASE_URL;
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}`;
    }
    return 'ws://localhost:8000';
};

export const API_CONFIG = {
    baseURL: getBaseUrl(),
    wsURL: getWsUrl(),
    timeout: 30000,
    withCredentials: true,
};

// Media URL helper
export const getMediaUrl = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_CONFIG.baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
};
