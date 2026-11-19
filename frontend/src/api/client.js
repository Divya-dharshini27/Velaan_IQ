/**
 * VELAAN IQ API Client
 * Wraps native fetch with auth headers, error normalization,
 * and automatic 401/403 session expiration handling.
 */

// If running in dev server with Vite proxy, use relative path to prevent cross-origin issues
const API_BASE =
  typeof window !== 'undefined' && window.location.port === '5173'
    ? ''
    : (import.meta.env.VITE_API_URL !== undefined
        ? import.meta.env.VITE_API_URL
        : 'http://127.0.0.1:8000');

class ApiError extends Error {
  constructor(message, status = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function getToken() {
  return localStorage.getItem('velaan_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('velaan_token', token);
  } else {
    localStorage.removeItem('velaan_token');
  }
}

export function clearAuth() {
  localStorage.removeItem('velaan_token');
  localStorage.removeItem('velaan_user');
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  // Add JSON Content-Type if not FormData and body is present
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(
      `Cannot reach the VELAAN IQ server at ${API_BASE}. Is the backend running?`,
      0,
      err
    );
  }

  // Handle unauthorized / expired token
  if (response.status === 401 || response.status === 403) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velaan:session-expired', {
        detail: { message: 'Session expired, please sign in again' }
      }));
    }
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;

    if (data && typeof data === 'object') {
      if (Array.isArray(data.detail)) {
        // FastAPI 422 validation errors array
        const messages = data.detail.map((err) => {
          const loc = Array.isArray(err.loc) ? err.loc.filter(x => x !== 'body').join('.') : '';
          return loc ? `${loc}: ${err.msg}` : err.msg;
        });
        errorMessage = messages.join('; ');
      } else if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (data.message) {
        errorMessage = data.message;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      errorMessage = data;
    }

    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options = {}) =>
    request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  upload: (endpoint, formData, options = {}) =>
    request(endpoint, {
      method: 'POST',
      body: formData,
      ...options,
    }),
};

// API Services grouped by feature
export const authApi = {
  login: (email, password) =>
    api.post('/api/v1/auth/login', { email, password }),
  register: (email, password, full_name) =>
    api.post('/api/v1/auth/register', { email, password, full_name }),
  me: () => api.get('/api/v1/auth/me'),
};

export const dashboardApi = {
  getDashboard: () => api.get('/api/v1/dashboard'),
};

export const procurementApi = {
  recommend: (params = {}) => api.post('/api/v1/procurement/recommend', params),
  getDecisions: (page = 1, pageSize = 20) =>
    api.get(`/api/v1/procurement/decisions?page=${page}&page_size=${pageSize}`),
};

export const scenariosApi = {
  simulate: (payload) => api.post('/api/v1/scenarios/simulate', payload),
  getScenarios: (page = 1, pageSize = 20) =>
    api.get(`/api/v1/scenarios?page=${page}&page_size=${pageSize}`),
};

export const marketApi = {
  getSummary: () => api.get('/api/v1/market-prices/summary'),
  getPrices: ({ page = 1, pageSize = 20, marketType = null } = {}) => {
    let url = `/api/v1/market-prices?page=${page}&page_size=${pageSize}`;
    if (marketType) url += `&market_type=${marketType}`;
    return api.get(url);
  },
  createPrice: (priceData) => api.post('/api/v1/market-prices', priceData),
  uploadPrices: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload('/api/v1/market-prices/upload', formData);
  },
};

export const forecastApi = {
  generate: ({ market_type = 'DOMESTIC', horizon_days = 7, market_name = null, force = false }) =>
    api.post('/api/v1/forecast/generate', {
      market_type,
      horizon_days: Number(horizon_days),
      ...(market_name ? { market_name } : {}),
      force: Boolean(force),
    }),
  getLatest: ({ market_type = 'DOMESTIC', horizon_days = 7, market_name = null } = {}) => {
    // Note: Backend router uses Literal[7, 30] = 7 for query param; omitting it uses the default integer 7
    let url = `/api/v1/forecast/latest?market_type=${market_type}`;
    if (market_name) url += `&market_name=${encodeURIComponent(market_name)}`;
    return api.get(url);
  },
  getEvaluation: ({ market_type = 'DOMESTIC', horizon_days = 7, market_name = null } = {}) => {
    let url = `/api/v1/forecast/evaluation?market_type=${market_type}`;
    if (market_name) url += `&market_name=${encodeURIComponent(market_name)}`;
    return api.get(url);
  },
};

export const sourcingApi = {
  compare: (payload) => api.post('/api/v1/sourcing/compare', payload),
};

export const inventoryApi = {
  getLatest: (commodity = 'SOYBEAN') =>
    api.get(`/api/v1/inventory?commodity=${commodity}`),
  create: (data) => api.post('/api/v1/inventory', data),
};

export const consumptionApi = {
  getSummary: (days = 30) => api.get(`/api/v1/consumption/summary?days=${days}`),
  create: (data) => api.post('/api/v1/consumption', data),
};

export const suppliersApi = {
  getSuppliers: ({ page = 1, pageSize = 20, sourcingType = null, active = null } = {}) => {
    let url = `/api/v1/suppliers?page=${page}&page_size=${pageSize}`;
    if (sourcingType) url += `&sourcing_type=${sourcingType}`;
    if (active !== null) url += `&active=${active}`;
    return api.get(url);
  },
  create: (data) => api.post('/api/v1/suppliers', data),
};

export const purchaseOrdersApi = {
  getOrders: ({ page = 1, pageSize = 20, status = null } = {}) => {
    let url = `/api/v1/purchase-orders?page=${page}&page_size=${pageSize}`;
    if (status) url += `&status=${status}`;
    return api.get(url);
  },
  create: (data) => api.post('/api/v1/purchase-orders', data),
};

export const exchangeRatesApi = {
  getRates: (page = 1, pageSize = 20) =>
    api.get(`/api/v1/exchange-rates?page=${page}&page_size=${pageSize}`),
  create: (data) => api.post('/api/v1/exchange-rates', data),
};

export const healthApi = {
  check: () => api.get('/api/v1/health'),
};

export default api;
