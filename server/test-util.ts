import { Request } from 'express';

/**
 * Test file with utility functions containing issues
 * Issues: Missing validation, type assertions, missing error handling
 */

/**
 * Test function with missing input validation
 */
export function testParseQueryParams(req: Request): {
  page: number;
  limit: number;
  status?: string;
} {
  const { page, limit, status } = req.query;
  
  // Issue: No validation that page and limit are numbers
  // Issue: Type assertion without validation
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  
  // Issue: No check if parseInt returned NaN
  // Issue: No validation of range (page > 0, limit > 0, etc.)
  
  return {
    page: pageNum,
    limit: limitNum,
    status: status as string,
  };
}

/**
 * Test function with missing null checks
 */
export function testFormatDate(date: Date | string): string {
  // Issue: No validation that date is valid
  // Issue: No check if date is null or undefined
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Issue: No validation that Date is valid (not NaN)
  return d.toISOString();
}

/**
 * Test function with missing error handling
 */
export function testSanitizeInput(input: string): string {
  // Issue: No validation that input is a string
  // Issue: No check for null/undefined
  
  // Issue: Basic sanitization, might not catch all cases
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Test function with type assertion issues
 */
export function testExtractUser(req: Request): {
  userId: string;
  username: string;
  installationId: number;
} {
  // Issue: Type assertion without validation
  const user = req.user as any;
  
  // Issue: No null check
  // Issue: No validation that properties exist
  return {
    userId: user._id.toString(),
    username: user.username,
    installationId: user.installationId,
  };
}

/**
 * Test function with missing validation
 */
export function testValidatePagination(page: number, limit: number): boolean {
  // Issue: No check if page and limit are numbers
  // Issue: No check for NaN
  // Issue: No upper bound check for limit
  
  return page > 0 && limit > 0;
}

/**
 * Test function with potential division by zero
 */
export function testCalculateTotalPages(total: number, limit: number): number {
  // Issue: No check if limit is 0 (division by zero)
  // Issue: No validation of input types
  
  return Math.ceil(total / limit);
}

/**
 * Test function with missing error handling
 */
export async function testRetryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  // Issue: No validation of maxRetries
  // Issue: No exponential backoff
  // Issue: No error logging
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      // Issue: No specific error handling
      // Issue: No delay between retries
      if (i === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  // Issue: Function might not return a value in all code paths
  throw new Error('Max retries exceeded');
}

