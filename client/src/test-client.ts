import { PRListResponse, PRDoc } from "./types/contracts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * Test file with issues similar to client.ts
 * Issues: Missing error handling, type assertions, missing validation
 */
async function testApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Issue: No validation that localStorage is available
  const token = localStorage.getItem("accessToken");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>), // Issue: Type assertion without validation
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Issue: No error handling for fetch
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Issue: No check if response is ok before parsing
  const data = await response.json();
  
  // Issue: No validation of response structure
  return data as T;
}

/**
 * Test function with missing error handling
 */
export async function testGetPRs(params: any = {}): Promise<PRListResponse> {
  const { page = 1, limit = 20, status, q } = params;
  
  // Issue: No validation of parameter types
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());
  
  if (status) {
    queryParams.append('status', status);
  }
  
  if (q) {
    queryParams.append('q', q);
  }
  
  // Issue: No try-catch, errors will propagate unhandled
  const response = await testApiRequest<PRListResponse>(`/api/prs?${queryParams.toString()}`);
  
  // Issue: No validation that response has expected structure
  return response;
}

/**
 * Test function with missing null checks
 */
export async function testGetPR(id: string): Promise<PRDoc> {
  // Issue: No validation that id is a valid string
  const response = await testApiRequest<{
    success: boolean;
    data: PRDoc;
  }>(`/api/prs/${id}`);
  
  // Issue: No check if response.success is true
  // Issue: No check if response.data exists
  return response.data;
}

/**
 * Test function with missing error handling and type assertions
 */
export async function testRegenerateSummary(id: string): Promise<{ ok: boolean }> {
  try {
    // Issue: No validation of id parameter
    const response = await testApiRequest<{
      success: boolean;
      message: string;
    }>(`/api/prs/${id}/regenerate`, {
      method: 'POST',
    });
    
    // Issue: Type assertion without validation
    return { ok: response.success as boolean };
  } catch (error: any) {
    // Issue: Using 'any' type, no specific error handling
    console.error('Error:', error.message);
    
    // Issue: Returning success even on error
    return { ok: false };
  }
}

/**
 * Test function with race condition potential
 */
let requestCount = 0;

export async function testConcurrentRequests(ids: string[]): Promise<PRDoc[]> {
  // Issue: No limit on concurrent requests
  // Issue: No error handling for individual requests
  const promises = ids.map(id => testGetPR(id));
  
  // Issue: No handling if some requests fail
  const results = await Promise.all(promises);
  
  // Issue: No validation of results
  requestCount += ids.length;
  
  return results;
}

/**
 * Test function with missing input validation
 */
export async function testSearchPRs(query: string): Promise<PRListResponse> {
  // Issue: No validation that query is a string
  // Issue: No sanitization of query string
  const response = await testApiRequest<PRListResponse>(`/api/prs?q=${query}`);
  
  // Issue: No validation of response structure
  return response;
}

