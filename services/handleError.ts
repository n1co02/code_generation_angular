/*This file was generated automatically.*/
import { HttpErrorResponse } from '@angular/common/http'
import { throwError } from 'rxjs'

export function handleError(error: HttpErrorResponse) {
  let errorMessage = 'An unknown error has occurred.'
  if (error.error instanceof ErrorEvent) {
    // Client-side or network error occurred.
    errorMessage = `An error occurred: ${error.error.message}`
  } else {
    // The backend returned an unsuccessful response code.
    errorMessage = `Server returned code ${error.status}, error message is: ${error.message}`
  }
  console.error(errorMessage)
  // Return an observable with a user-facing error message.
  return throwError(() => new Error(errorMessage))
}
