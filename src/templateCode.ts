// service-templates.ts
export const SERVICE_TEMPLATE = `
@Injectable({
  providedIn: 'root'
})
export class {{className}} {
  constructor(private http: HttpClient) { }

{{methods}}
}
`
export const METHOD_TEMPLATE = `
  public {{methodName}}{{params}}: Observable<{{responseType}}> {
    return this.http.{{httpMethod}}<{{responseType}}>({{url}}{{bodyParam}}, { observe: 'response' }).pipe(
      map((response: { status: number; body: {{responseType}} | null }) => {
        if (response.status === {{successCode}} && response.body !== null) {
          return response.body; 
        } else {
          throw new Error('Unexpected status code'); 
        }
      }),
      catchError(handleError) 
    );
  }\n`
// service-templates.ts
export const ANGULAR_SERVICE_TEMPLATE = `/*This file was generated automatically.
************************ Your Imports may be different. *************************/
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ENVIRONMENT_BASE_API_URL } from '../environments';/*Don't forget to change the path and add an env variable with a connection string file.*/
import { catchError, map } from 'rxjs/operators';
import { handleError } from './ChangeFilePath'/*Don't forget to change the path of the handleError file.*/;
import { {{interfaces}} } from './interfaces/ChangeFilePath';/*Don't forget to change the path of the interfaces file.*/

{{serviceClass}}
`
export const HANDLE_ERROR_TEMPLATE = `/*This file was generated automatically.*/
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';

export function handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error has occurred.';
    if (error.error instanceof ErrorEvent) {
        // Client-side or network error occurred.
        errorMessage = \`An error occurred: \${error.error.message}\`;
    } else {
        // The backend returned an unsuccessful response code.
        errorMessage = \`Server returned code \${error.status}, error message is: \${error.message}\`;
    }
    console.error(errorMessage);
    // Return an observable with a user-facing error message.
    return throwError(() => new Error(errorMessage));
}
`
