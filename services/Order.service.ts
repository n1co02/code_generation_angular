/*This file was generated automatically.
 ************************Your Imports may be different.*************************/
  import { Injectable } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { ENVIRONMENT_BASE_API_URL } from '../environments';/*Don't forget to change the path and add a env variable with a connection string file.*/
  import { catchError, map } from 'rxjs/operators';
  import { handleError } from './ChangeFilePath'/*Don't forget to change the path of the handleError file.*/;
  import { Order, ProblemDetails, Product } from './interfaces/ChangeFilePath';/*Don't forget to change the path of the interfaces file.*/


@Injectable({
    providedIn: 'root'
  })
  export class OrderService {
    constructor(private http: HttpClient) { }
 
    public getOrder(): Observable<Array<Order>> {
      return this.http.get<Array<Order>>(`${ENVIRONMENT_BASE_API_URL}/Order`, { observe: 'response' }).pipe(
        map((response: { status: number; body: Array<Order> | null }) => {
          if (response.status === 200 && response.body !== null) {
            return response.body; 
          } else {
            throw new Error('Unexpected status code'); 
          }
        }),
        catchError(handleError) 
      );
    }
 
    public getId(id: string): Observable<Order> {
      return this.http.get<Order>(`${ENVIRONMENT_BASE_API_URL}/Order/${id}`, { observe: 'response' }).pipe(
        map((response: { status: number; body: Order | null }) => {
          if (response.status === 200 && response.body !== null) {
            return response.body; 
          } else {
            throw new Error('Unexpected status code'); 
          }
        }),
        catchError(handleError) 
      );
    }
}