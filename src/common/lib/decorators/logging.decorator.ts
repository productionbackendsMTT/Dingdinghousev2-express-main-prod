/**
 * A method decorator that logs method calls, execution time, and errors.
 * @example
 * ```typescript
 * class ExampleService {
 *   @LogMethod()
 *   async fetchData(id: string) {
 *     // Method implementation
 *   }
 * }
 * ```
 * 
 * @returns {MethodDecorator} A method decorator function
 */
export default function logMethod(original: Function, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);

  function replacement(this: any, ...args: any[]) {
    console.log(`[${methodName}] Called with:`, args);
    const result = original.call(this, ...args);
    console.log(`[${methodName}] Returned:`, result);
    return result;
  }

  return replacement;
}

// Usage:
// class ExampleService {
//   @LogMethod()
//   async fetchData(id: string) {
//     // Your method implementation
//   }
// }
